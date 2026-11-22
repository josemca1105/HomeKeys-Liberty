import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import type { Express } from "express";
import sharp from "sharp";
import request from "supertest";
import { createApp } from "../src/app";
import {
  InMemoryObjectStorage,
  LocalObjectStorage,
  MAX_PHOTO_BYTES,
  setObjectStorageForTesting,
} from "../src/services/object-storage-service";
import {
  createMockDatabase,
  TEST_ADMIN_PASSWORD,
  TEST_NEW_USER_PASSWORD,
  TEST_PARTNER_PASSWORD,
} from "./helpers/mock-database";
import type { MockDatabase } from "./helpers/mock-database";

const propertyPayload = (): Record<string, unknown> => ({
  title: "Casa para fotografías",
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
});

describe("Property photo HTTP integration", { concurrency: false }, () => {
  let app: Express;
  let database: MockDatabase;
  let storage: InMemoryObjectStorage;
  let adminToken: string;
  let partnerToken: string;
  let propertyId: number;

  const createJpeg = async (): Promise<Buffer> =>
    sharp({
      create: {
        width: 40,
        height: 30,
        channels: 3,
        background: { r: 220, g: 40, b: 40 },
      },
    })
      .jpeg({ quality: 85 })
      .toBuffer();

  const login = async (email: string, password: string): Promise<string> => {
    const response = await request(app)
      .post("/api/v1/auth/login")
      .send({ email, password });
    assert.equal(response.status, 200);
    return response.body.data.token as string;
  };

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

    const initialBatch = database.addReadyPhotoBatch(2, 5);
    const created = await request(app)
      .post("/api/v1/properties")
      .set("Authorization", `Bearer ${partnerToken}`)
      .send({
        ...propertyPayload(),
        photoBatchId: initialBatch.batch.id,
      });
    assert.equal(created.status, 201);
    propertyId = created.body.data.property.id as number;
    assert.equal(created.body.data.property.photos.length, 5);
  });

  afterEach(() => {
    setObjectStorageForTesting(null);
  });

  const createUpload = async (
    token: string,
    mimeType = "image/jpeg",
    sizeBytes?: number,
  ): Promise<request.Response> => {
    const image = await createJpeg();

    return request(app)
      .post(`/api/v1/properties/${propertyId}/photos/upload-url`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        mimeType,
        sizeBytes: sizeBytes ?? image.length,
      });
  };

  const uploadPhoto = async (
    token: string,
    altText?: string,
  ): Promise<{
    target: {
      url: string;
      method: string;
      headers: Record<string, string>;
      expiresAt: string;
      storageKey: string;
    };
    body: Buffer;
    photo: Record<string, unknown>;
  }> => {
    const body = await createJpeg();
    const targetResponse = await createUpload(
      token,
      "image/jpeg",
      body.byteLength,
    );
    assert.equal(targetResponse.status, 200);
    const target = targetResponse.body.data.upload;
    await storage.putObject(target.storageKey, body, "image/jpeg");

    const confirmation = await request(app)
      .post(`/api/v1/properties/${propertyId}/photos/confirm`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        storageKey: target.storageKey,
        ...(altText !== undefined ? { altText } : {}),
      });

    assert.equal(confirmation.status, 201);
    return {
      target,
      body,
      photo: confirmation.body.data.photo,
    };
  };

  it("uploads through a signed target, converts to WebP and removes EXIF", async () => {
    const uploaded = await uploadPhoto(partnerToken, "Fachada principal");
    const photo = uploaded.photo as {
      id: number;
      isCover: boolean;
      mimeType: string;
      altText: string;
      url: string;
    };

    assert.equal(photo.isCover, false);
    assert.equal(photo.mimeType, "image/webp");
    assert.equal(photo.altText, "Fachada principal");
    assert.equal(
      photo.url,
      `/api/v1/properties/${propertyId}/photos/${photo.id}/content`,
    );

    assert.equal(
      await storage.headObject(uploaded.target.storageKey),
      null,
    );
    assert.equal(database.photos.length, 6);

    const storedPhoto = database.photos.find(
      (item) => item.id === photo.id,
    );
    assert.ok(storedPhoto);
    const stored = await storage.downloadObject(storedPhoto.storageKey);
    const metadata = await sharp(stored.body).metadata();
    assert.equal(metadata.format, "webp");
    assert.equal(metadata.exif, undefined);
    assert.equal(metadata.width, 40);
    assert.equal(metadata.height, 30);

    const propertyRead = await request(app)
      .get(`/api/v1/properties/${propertyId}`)
      .set("Authorization", `Bearer ${partnerToken}`);
    assert.equal(propertyRead.status, 200);
    assert.equal(propertyRead.body.data.property.photos.length, 6);

    assert.equal(
      database.auditLogs.some(
        (log) =>
          log.action === "PROPERTY_PHOTO_ADDED" &&
          log.entityId === propertyId,
      ),
      true,
    );
  });

  it("keeps exactly one cover and allows cover/reorder changes", async () => {
    const first = await uploadPhoto(partnerToken);
    const second = await uploadPhoto(partnerToken);
    const firstId = first.photo.id as number;
    const secondId = second.photo.id as number;

    assert.equal(first.photo.isCover, false);
    assert.equal(second.photo.isCover, false);

    const coverResponse = await request(app)
      .patch(`/api/v1/properties/${propertyId}/photos/${secondId}/cover`)
      .set("Authorization", `Bearer ${partnerToken}`);

    assert.equal(coverResponse.status, 200);
    assert.equal(coverResponse.body.data.photo.isCover, true);
    assert.equal(
      database.photos.filter((photo) => photo.isCover).length,
      1,
    );
    assert.equal(
      database.photos.find((photo) => photo.id === firstId)?.isCover,
      false,
    );

    const remainingIds = database.photos
      .filter((photo) => photo.id !== firstId && photo.id !== secondId)
      .map((photo) => photo.id);
    const desiredOrder = [secondId, firstId, ...remainingIds];
    const reorder = await request(app)
      .patch(`/api/v1/properties/${propertyId}/photos/order`)
      .set("Authorization", `Bearer ${partnerToken}`)
      .send({ photoIds: desiredOrder });

    assert.equal(reorder.status, 200);
    assert.deepEqual(
      reorder.body.data.photos.map((photo: { id: number }) => photo.id),
      desiredOrder,
    );
    assert.deepEqual(
      reorder.body.data.photos.map(
        (photo: { sortOrder: number }) => photo.sortOrder,
      ),
      desiredOrder.map((_id, index) => index),
    );

    const incompleteOrder = await request(app)
      .patch(`/api/v1/properties/${propertyId}/photos/order`)
      .set("Authorization", `Bearer ${partnerToken}`)
      .send({ photoIds: [firstId] });

    assert.equal(incompleteOrder.status, 400);
    assert.equal(incompleteOrder.body.code, "PHOTO_ORDER_MISMATCH");

    assert.equal(
      database.auditLogs.some(
        (log) => log.action === "PROPERTY_PHOTO_COVER_CHANGED",
      ),
      true,
    );
    assert.equal(
      database.auditLogs.some(
        (log) => log.action === "PROPERTY_PHOTOS_REORDERED",
      ),
      true,
    );
  });

  it("promotes another cover and removes the object when a photo is deleted", async () => {
    await uploadPhoto(partnerToken);
    const second = await uploadPhoto(partnerToken);
    const secondId = second.photo.id as number;

    await request(app)
      .patch(`/api/v1/properties/${propertyId}/photos/${secondId}/cover`)
      .set("Authorization", `Bearer ${partnerToken}`);

    const secondStorageKey = database.photos.find(
      (photo) => photo.id === secondId,
    )!.storageKey;

    const deletion = await request(app)
      .delete(`/api/v1/properties/${propertyId}/photos/${secondId}`)
      .set("Authorization", `Bearer ${partnerToken}`);

    assert.equal(deletion.status, 200);
    assert.equal(deletion.body.data.deletedId, secondId);
    assert.equal(database.photos.length, 6);
    assert.equal(
      database.photos.filter((photo) => photo.isCover).length,
      1,
    );
    assert.equal(
      database.photos.find((photo) => photo.id === secondId),
      undefined,
    );
    assert.equal(await storage.headObject(secondStorageKey), null);

    const contentAfterDelete = await request(app)
      .get(`/api/v1/properties/${propertyId}/photos/${secondId}/content`)
      .set("Authorization", `Bearer ${partnerToken}`);

    assert.equal(contentAfterDelete.status, 404);
    assert.equal(contentAfterDelete.body.code, "PHOTO_NOT_FOUND");

    assert.equal(
      database.auditLogs.some(
        (log) => log.action === "PROPERTY_PHOTO_DELETED",
      ),
      true,
    );
  });

  it("never allows deleting below five photos", async () => {
    const initialPhotoId = database.photos[0]!.id;

    const blocked = await request(app)
      .delete(`/api/v1/properties/${propertyId}/photos/${initialPhotoId}`)
      .set("Authorization", `Bearer ${partnerToken}`);

    assert.equal(blocked.status, 409);
    assert.equal(blocked.body.code, "MINIMUM_PHOTOS_REQUIRED");
    assert.equal(database.photos.length, 5);

    const uploaded = await uploadPhoto(partnerToken);
    assert.equal(database.photos.length, 6);

    const allowed = await request(app)
      .delete(`/api/v1/properties/${propertyId}/photos/${initialPhotoId}`)
      .set("Authorization", `Bearer ${partnerToken}`);

    assert.equal(allowed.status, 200);
    assert.equal(database.photos.length, 5);
    assert.equal(
      database.photos.some((photo) => photo.id === uploaded.photo.id),
      true,
    );
  });

  it("serves content only to the owner or ADMIN", async () => {
    const uploaded = await uploadPhoto(partnerToken);
    const photoId = uploaded.photo.id as number;
    const photoUrl = uploaded.photo.url as string;

    const ownerRead = await request(app)
      .get(photoUrl)
      .set("Authorization", `Bearer ${partnerToken}`);
    assert.equal(ownerRead.status, 200);
    assert.equal(ownerRead.headers["content-type"], "image/webp");
    assert.equal(ownerRead.body.length > 0, true);

    const adminRead = await request(app)
      .get(photoUrl)
      .set("Authorization", `Bearer ${adminToken}`);
    assert.equal(adminRead.status, 200);

    database.addUser({
      id: 3,
      email: "photo-other@example.com",
      role: "PARTNER",
      password: TEST_NEW_USER_PASSWORD,
    });
    const otherToken = await login(
      "photo-other@example.com",
      TEST_NEW_USER_PASSWORD,
    );

    const foreignRead = await request(app)
      .get(photoUrl)
      .set("Authorization", `Bearer ${otherToken}`);
    assert.equal(foreignRead.status, 404);

    const anonymousRead = await request(app).get(photoUrl);
    assert.equal(anonymousRead.status, 401);

    const missingPhoto = await request(app)
      .get(`/api/v1/properties/${propertyId}/photos/9999/content`)
      .set("Authorization", `Bearer ${partnerToken}`);
    assert.equal(missingPhoto.status, 404);
    assert.equal(missingPhoto.body.code, "PHOTO_NOT_FOUND");

    assert.equal(typeof photoId, "number");
  });

  it("rejects unsupported files, forged keys and invalid images", async () => {
    const unsupported = await createUpload(partnerToken, "image/gif", 100);
    assert.equal(unsupported.status, 400);

    const tooLarge = await createUpload(
      partnerToken,
      "image/jpeg",
      MAX_PHOTO_BYTES + 1,
    );
    assert.equal(tooLarge.status, 400);

    const forgedKey = await request(app)
      .post(`/api/v1/properties/${propertyId}/photos/confirm`)
      .set("Authorization", `Bearer ${partnerToken}`)
      .send({
        storageKey:
          "properties/999999/uploads/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa.webp",
      });
    assert.equal(forgedKey.status, 400);
    assert.equal(forgedKey.body.code, "INVALID_PHOTO_UPLOAD_KEY");

    const missingObject = await request(app)
      .post(`/api/v1/properties/${propertyId}/photos/confirm`)
      .set("Authorization", `Bearer ${partnerToken}`)
      .send({
        storageKey: `properties/${propertyId}/uploads/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa.jpg`,
      });
    assert.equal(missingObject.status, 422);
    assert.equal(missingObject.body.code, "PHOTO_UPLOAD_NOT_FOUND");

    const body = Buffer.from("this is not a decodable image");
    const invalidTarget = await createUpload(
      partnerToken,
      "image/jpeg",
      body.byteLength,
    );
    const invalidKey = invalidTarget.body.data.upload.storageKey as string;
    await storage.putObject(invalidKey, body, "image/jpeg");

    const invalidImage = await request(app)
      .post(`/api/v1/properties/${propertyId}/photos/confirm`)
      .set("Authorization", `Bearer ${partnerToken}`)
      .send({ storageKey: invalidKey });

    assert.equal(invalidImage.status, 422);
    assert.equal(invalidImage.body.code, "INVALID_PHOTO_IMAGE");
    assert.equal(database.photos.length, 5);
    assert.equal(await storage.headObject(invalidKey), null);
  });

  it("enforces the twenty-photo limit", async () => {
    const now = new Date();

    for (let index = 0; index < 15; index += 1) {
      database.photos.push({
        id: 100 + index,
        propertyId,
        storageKey: `properties/${propertyId}/photos/seed-${index}.webp`,
        mimeType: "image/webp",
        sizeBytes: 100,
        width: 10,
        height: 10,
        altText: null,
        sortOrder: index,
        isCover: index === 0,
        createdAt: now,
        updatedAt: now,
      });
    }

    const response = await createUpload(partnerToken, "image/jpeg", 100);

    assert.equal(response.status, 409);
    assert.equal(response.body.code, "PHOTO_LIMIT_REACHED");
  });

  it("blocks photo changes on closed captures for PARTNER only", async () => {
    await request(app)
      .patch(`/api/v1/properties/${propertyId}`)
      .set("Authorization", `Bearer ${partnerToken}`)
      .send({ status: "CLOSED" });

    const partnerTarget = await createUpload(partnerToken);
    assert.equal(partnerTarget.status, 409);
    assert.equal(partnerTarget.body.code, "PROPERTY_CLOSED");

    const adminTarget = await createUpload(adminToken);
    assert.equal(adminTarget.status, 200);
  });

  it("supports the signed local upload endpoint", async () => {
    const temporaryRoot = await mkdtemp(
      path.join(tmpdir(), "homekeys-photo-test-"),
    );
    const localStorage = new LocalObjectStorage(temporaryRoot);
    setObjectStorageForTesting(localStorage);

    try {
      const image = await createJpeg();
      const targetResponse = await createUpload(
        partnerToken,
        "image/jpeg",
        image.byteLength,
      );
      assert.equal(targetResponse.status, 200);
      const target = targetResponse.body.data.upload;
      assert.equal(
        target.url,
        "/api/v1/property-photos/local-upload",
      );

      const uploadResponse = await request(app)
        .put(target.url)
        .set("Content-Type", "image/jpeg")
        .set(
          "X-Photo-Upload-Token",
          target.headers["X-Photo-Upload-Token"],
        )
        .send(image);
      assert.equal(uploadResponse.status, 204);

      const confirmation = await request(app)
        .post(`/api/v1/properties/${propertyId}/photos/confirm`)
        .set("Authorization", `Bearer ${partnerToken}`)
        .send({ storageKey: target.storageKey });
      assert.equal(confirmation.status, 201);
      assert.equal(confirmation.body.data.photo.mimeType, "image/webp");

      const content = await request(app)
        .get(
          `/api/v1/properties/${propertyId}/photos/${confirmation.body.data.photo.id}/content`,
        )
        .set("Authorization", `Bearer ${partnerToken}`);
      assert.equal(content.status, 200);
      assert.equal(content.headers["content-type"], "image/webp");
    } finally {
      await rm(temporaryRoot, { recursive: true, force: true });
    }
  });
});
