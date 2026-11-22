import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import type { Express } from "express";
import sharp from "sharp";
import request from "supertest";
import { createApp } from "../src/app";
import {
  cleanupExpiredPhotoBatches,
} from "../src/services/property-photo-batch-service";
import {
  InMemoryObjectStorage,
  setObjectStorageForTesting,
} from "../src/services/object-storage-service";
import {
  createMockDatabase,
  TEST_ADMIN_PASSWORD,
  TEST_NEW_USER_PASSWORD,
  TEST_PARTNER_PASSWORD,
} from "./helpers/mock-database";
import type { MockDatabase } from "./helpers/mock-database";

const propertyPayload = (
  overrides: Record<string, unknown> = {},
): Record<string, unknown> => ({
  title: "Casa con lote previo",
  propertyType: "HOUSE",
  listingType: "SALE",
  ownerName: "Propietario Prueba",
  ownerPhone: "0414-1234567",
  address: "Av. Principal, casa 1",
  city: "Valencia",
  state: "Carabobo",
  latitude: 10.1234567,
  longitude: -68.1234567,
  price: 100000,
  bedrooms: 3,
  bathrooms: 2,
  parkingSpaces: 1,
  squareMeters: 100,
  ...overrides,
});

describe("Property photo batch HTTP integration", { concurrency: false }, () => {
  let app: Express;
  let database: MockDatabase;
  let storage: InMemoryObjectStorage;
  let adminToken: string;
  let partnerToken: string;

  beforeEach(async () => {
    database = createMockDatabase();
    app = createApp();
    storage = new InMemoryObjectStorage();
    setObjectStorageForTesting(storage);

    adminToken = await login("admin@example.com", TEST_ADMIN_PASSWORD);
    partnerToken = await login(
      "partner@example.com",
      TEST_PARTNER_PASSWORD,
    );
  });

  const login = async (email: string, password: string): Promise<string> => {
    const response = await request(app)
      .post("/api/v1/auth/login")
      .send({ email, password });
    assert.equal(response.status, 200);
    return response.body.data.token as string;
  };

  const createBatch = async (
    token = partnerToken,
  ): Promise<Record<string, unknown>> => {
    const response = await request(app)
      .post("/api/v1/property-photo-batches")
      .set("Authorization", `Bearer ${token}`);

    assert.equal(response.status, 201);
    return response.body.data.batch as Record<string, unknown>;
  };

  const createJpeg = async (): Promise<Buffer> =>
    sharp({
      create: {
        width: 40,
        height: 30,
        channels: 3,
        background: { r: 20, g: 140, b: 80 },
      },
    })
      .jpeg({ quality: 85 })
      .toBuffer();

  const uploadToBatch = async (
    batchId: string,
    token = partnerToken,
    altText?: string,
  ): Promise<Record<string, unknown>> => {
    const image = await createJpeg();
    const targetResponse = await request(app)
      .post(`/api/v1/property-photo-batches/${batchId}/photos/upload-url`)
      .set("Authorization", `Bearer ${token}`)
      .send({ mimeType: "image/jpeg", sizeBytes: image.byteLength });

    assert.equal(targetResponse.status, 200);
    const target = targetResponse.body.data.upload;
    await storage.putObject(target.storageKey, image, "image/jpeg");

    const confirmation = await request(app)
      .post(`/api/v1/property-photo-batches/${batchId}/photos/confirm`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        storageKey: target.storageKey,
        ...(altText !== undefined ? { altText } : {}),
      });

    assert.equal(confirmation.status, 201);
    return confirmation.body.data.upload as Record<string, unknown>;
  };

  const uploadMany = async (
    batchId: string,
    count: number,
    token = partnerToken,
  ): Promise<Array<Record<string, unknown>>> => {
    const uploads: Array<Record<string, unknown>> = [];

    for (let index = 0; index < count; index += 1) {
      uploads.push(
        await uploadToBatch(batchId, token, `Foto ${index + 1}`),
      );
    }

    return uploads;
  };

  const createPropertyWithBatch = async (
    token: string,
    batchId: string,
    overrides: Record<string, unknown> = {},
  ): Promise<request.Response> => {
    return request(app)
      .post("/api/v1/properties")
      .set("Authorization", `Bearer ${token}`)
      .send(propertyPayload({ photoBatchId: batchId, ...overrides }));
  };

  it("creates a capture atomically with five READY photos", async () => {
    const batch = await createBatch();
    const batchId = batch.id as string;
    const uploads = await uploadMany(batchId, 5);
    const coverUploadId = uploads[1]!.id as string;

    const batchRead = await request(app)
      .get(`/api/v1/property-photo-batches/${batchId}`)
      .set("Authorization", `Bearer ${partnerToken}`);
    assert.equal(batchRead.status, 200);
    assert.equal(batchRead.body.data.batch.uploads.length, 5);
    assert.equal(
      batchRead.body.data.batch.uploads.every(
        (upload: { status: string }) => upload.status === "READY",
      ),
      true,
    );

    const created = await createPropertyWithBatch(
      partnerToken,
      batchId,
      { coverUploadId },
    );

    assert.equal(created.status, 201);
    const property = created.body.data.property;
    assert.equal(property.photos.length, 5);
    assert.equal(
      property.photos.filter(
        (photo: { isCover: boolean }) => photo.isCover,
      ).length,
      1,
    );
    const selectedCover = property.photos.find(
      (photo: { isCover: boolean }) => photo.isCover,
    );
    const storedCover = database.photos.find(
      (photo) => photo.id === selectedCover.id,
    );
    const coverUpload = database.propertyPhotoUploads.find(
      (upload) => upload.id === coverUploadId,
    );
    assert.equal(storedCover?.storageKey, coverUpload?.storageKey);

    assert.equal(database.properties.length, 1);
    assert.equal(database.photos.length, 5);
    assert.equal(
      database.propertyPhotoBatches[0]?.status,
      "CONSUMED",
    );
    assert.equal(
      database.propertyPhotoUploads.every(
        (upload) => upload.status === "CONSUMED",
      ),
      true,
    );
    assert.equal(
      database.auditLogs.some(
        (log) => log.action === "PROPERTY_PHOTOS_ATTACHED",
      ),
      true,
    );
  });

  it("rejects four photos without creating a capture and allows retry", async () => {
    const insufficient = database.addReadyPhotoBatch(2, 4);
    const rejected = await createPropertyWithBatch(
      partnerToken,
      insufficient.batch.id,
    );

    assert.equal(rejected.status, 422);
    assert.equal(rejected.body.code, "MINIMUM_PHOTOS_REQUIRED");
    assert.equal(database.properties.length, 0);
    assert.equal(database.photos.length, 0);
    assert.equal(
      database.propertyPhotoBatches[0]?.status,
      "OPEN",
    );

    const valid = database.addReadyPhotoBatch(2, 5);
    const created = await createPropertyWithBatch(
      partnerToken,
      valid.batch.id,
    );

    assert.equal(created.status, 201);
    assert.equal(created.body.data.property.photos.length, 5);
    assert.equal(
      created.body.data.property.photos.find(
        (photo: { isCover: boolean }) => photo.isCover,
      ).id,
      database.photos[0]?.id,
    );
  });

  it("rejects foreign, expired, reused and invalid-cover batches", async () => {
    const foreign = database.addReadyPhotoBatch(2, 5);
    const foreignResponse = await createPropertyWithBatch(
      adminToken,
      foreign.batch.id,
    );
    assert.equal(foreignResponse.status, 404);
    assert.equal(foreignResponse.body.code, "PHOTO_BATCH_NOT_FOUND");

    const expired = database.addReadyPhotoBatch(2, 5);
    expired.batch.expiresAt = new Date(Date.now() - 1000);
    const expiredRecord = database.propertyPhotoBatches.find(
      (batch) => batch.id === expired.batch.id,
    );
    assert.ok(expiredRecord);
    expiredRecord.expiresAt = expired.batch.expiresAt;

    const expiredResponse = await createPropertyWithBatch(
      partnerToken,
      expired.batch.id,
    );
    assert.equal(expiredResponse.status, 409);
    assert.equal(expiredResponse.body.code, "PHOTO_BATCH_EXPIRED");

    const valid = database.addReadyPhotoBatch(2, 5);
    const created = await createPropertyWithBatch(
      partnerToken,
      valid.batch.id,
    );
    assert.equal(created.status, 201);

    const reused = await createPropertyWithBatch(
      partnerToken,
      valid.batch.id,
    );
    assert.equal(reused.status, 409);
    assert.equal(reused.body.code, "PHOTO_BATCH_NOT_OPEN");
    assert.equal(database.properties.length, 1);

    const invalidCoverBatch = database.addReadyPhotoBatch(2, 5);
    const otherBatch = database.addReadyPhotoBatch(2, 1);
    const invalidCover = await createPropertyWithBatch(
      partnerToken,
      invalidCoverBatch.batch.id,
      { coverUploadId: otherBatch.uploads[0]?.id },
    );
    assert.equal(invalidCover.status, 422);
    assert.equal(invalidCover.body.code, "INVALID_COVER_PHOTO");
    assert.equal(database.properties.length, 1);
  });

  it("previews and removes batch uploads before creation", async () => {
    const batch = await createBatch();
    const batchId = batch.id as string;
    const first = await uploadToBatch(batchId);
    const second = await uploadToBatch(batchId);
    const firstId = first.id as string;

    const content = await request(app)
      .get(
        `/api/v1/property-photo-batches/${batchId}/photos/${firstId}/content`,
      )
      .set("Authorization", `Bearer ${partnerToken}`);
    assert.equal(content.status, 200);
    assert.equal(content.headers["content-type"], "image/webp");

    database.addUser({
      id: 3,
      email: "batch-other@example.com",
      role: "PARTNER",
      password: TEST_NEW_USER_PASSWORD,
    });
    const otherToken = await login(
      "batch-other@example.com",
      TEST_NEW_USER_PASSWORD,
    );

    const foreignContent = await request(app)
      .get(
        `/api/v1/property-photo-batches/${batchId}/photos/${firstId}/content`,
      )
      .set("Authorization", `Bearer ${otherToken}`);
    assert.equal(foreignContent.status, 404);

    const deletion = await request(app)
      .delete(
        `/api/v1/property-photo-batches/${batchId}/photos/${firstId}`,
      )
      .set("Authorization", `Bearer ${partnerToken}`);
    assert.equal(deletion.status, 200);

    const batchRead = await request(app)
      .get(`/api/v1/property-photo-batches/${batchId}`)
      .set("Authorization", `Bearer ${partnerToken}`);
    assert.equal(batchRead.status, 200);
    assert.equal(batchRead.body.data.batch.uploads.length, 1);
    assert.equal(batchRead.body.data.batch.uploads[0].id, second.id);
  });

  it("enforces the twenty-upload limit on the temporary batch", async () => {
    const batch = database.addReadyPhotoBatch(2, 20);
    const response = await request(app)
      .post(
        `/api/v1/property-photo-batches/${batch.batch.id}/photos/upload-url`,
      )
      .set("Authorization", `Bearer ${partnerToken}`)
      .send({ mimeType: "image/jpeg", sizeBytes: 100 });

    assert.equal(response.status, 409);
    assert.equal(response.body.code, "PHOTO_LIMIT_REACHED");
  });

  it("removes expired open batches and their temporary uploads", async () => {
    const expired = database.addReadyPhotoBatch(2, 2);
    const storedBatch = database.propertyPhotoBatches.find(
      (batch) => batch.id === expired.batch.id,
    );
    assert.ok(storedBatch);
    storedBatch.expiresAt = new Date(Date.now() - 60_000);

    const removed = await cleanupExpiredPhotoBatches();

    assert.equal(removed, 1);
    assert.equal(
      database.propertyPhotoBatches.some(
        (batch) => batch.id === expired.batch.id,
      ),
      false,
    );
    assert.equal(
      database.propertyPhotoUploads.some(
        (upload) => upload.batchId === expired.batch.id,
      ),
      false,
    );
  });
});
