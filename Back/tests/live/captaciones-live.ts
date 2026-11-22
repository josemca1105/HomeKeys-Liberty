/**
 * Live verification for property captures against PostgreSQL.
 *
 * This script is excluded from `npm test`. It creates temporary users and
 * captures through the HTTP API, uses a temporary local photo directory and
 * removes every row and object at the end, including on failure.
 *
 * Run from Back with:
 *   npx tsx tests/live/captaciones-live.ts
 */
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import request from "supertest";
import sharp from "sharp";
import { Role } from "@prisma/client";
import { createApp } from "../../src/app";
import { prisma } from "../../src/config/database";
import {
  LocalObjectStorage,
  setObjectStorageForTesting,
} from "../../src/services/object-storage-service";
import { hashPassword } from "../../src/utils/password";

const SUFFIX = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
const PASSWORD = "Live-Captures-Password1!";
const app = createApp();
let storageRoot = "";

const userIds: number[] = [];
const propertyIds: number[] = [];
const photoIds: number[] = [];
const batchIds: string[] = [];

const login = async (email: string): Promise<string> => {
  const response = await request(app)
    .post("/api/v1/auth/login")
    .send({ email, password: PASSWORD });

  assert.equal(response.status, 200, "Live user must be able to log in");
  return response.body.data.token as string;
};

const createPropertyPayload = (): Record<string, unknown> => ({
  title: "Live capture",
  propertyType: "HOUSE",
  listingType: "SALE",
  ownerName: "Live Owner",
  ownerPhone: "0414-1234567",
  address: "Av. Live, casa 1",
  city: "Valencia",
  state: "Carabobo",
  latitude: 10.1234567,
  longitude: -68.1234567,
  price: 150000,
  maintenanceFee: 80,
  bedrooms: 3,
  bathrooms: 2,
  parkingSpaces: 1,
  squareMeters: 120,
  hasWaterTank: true,
});

const cleanup = async (): Promise<void> => {
  if (photoIds.length > 0) {
    await prisma.photo.deleteMany({ where: { id: { in: photoIds } } });
  }

  if (propertyIds.length > 0) {
    await prisma.photo.deleteMany({
      where: { propertyId: { in: propertyIds } },
    });
    await prisma.property.deleteMany({
      where: { id: { in: propertyIds } },
    });
  }

  if (batchIds.length > 0) {
    await prisma.propertyPhotoBatch.deleteMany({
      where: { id: { in: batchIds } },
    });
  }

  if (userIds.length > 0) {
    await prisma.auditLog.deleteMany({
      where: { actorId: { in: userIds } },
    });
    await prisma.revokedToken.deleteMany({
      where: { userId: { in: userIds } },
    });
    await prisma.passwordResetToken.deleteMany({
      where: { userId: { in: userIds } },
    });
    await prisma.passwordHistory.deleteMany({
      where: { userId: { in: userIds } },
    });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  }

  if (storageRoot !== "") {
    await rm(storageRoot, { recursive: true, force: true });
  }
};

const run = async (): Promise<void> => {
  storageRoot = await mkdtemp(path.join(tmpdir(), "homekeys-captures-live-"));
  setObjectStorageForTesting(new LocalObjectStorage(storageRoot));

  const passwordHash = await hashPassword(PASSWORD);
  const admin = await prisma.user.create({
    data: {
      firstName: "Live",
      lastName: "Admin",
      email: `live-captures-admin-${SUFFIX}@example.com`,
      passwordHash,
      phone: "04140000001",
      role: Role.ADMIN,
    },
  });
  const partner = await prisma.user.create({
    data: {
      firstName: "Live",
      lastName: "Partner",
      email: `live-captures-partner-${SUFFIX}@example.com`,
      passwordHash,
      phone: "04140000002",
      role: Role.PARTNER,
    },
  });
  userIds.push(admin.id, partner.id);

  const partnerToken = await login(partner.email);
  const adminToken = await login(admin.email);

  const batchResponse = await request(app)
    .post("/api/v1/property-photo-batches")
    .set("Authorization", `Bearer ${partnerToken}`);
  assert.equal(batchResponse.status, 201);
  const batchId = batchResponse.body.data.batch.id as string;
  batchIds.push(batchId);

  const batchUploadIds: string[] = [];

  for (let index = 0; index < 5; index += 1) {
    const image = await sharp({
      create: {
        width: 32 + index,
        height: 24,
        channels: 3,
        background: { r: 20 + index * 10, g: 120, b: 220 },
      },
    })
      .jpeg()
      .toBuffer();
    const uploadTarget = await request(app)
      .post(`/api/v1/property-photo-batches/${batchId}/photos/upload-url`)
      .set("Authorization", `Bearer ${partnerToken}`)
      .send({ mimeType: "image/jpeg", sizeBytes: image.byteLength });
    assert.equal(uploadTarget.status, 200);

    const upload = uploadTarget.body.data.upload;
    const uploadResponse = await request(app)
      .put(upload.url)
      .set("Content-Type", "image/jpeg")
      .set("X-Photo-Upload-Token", upload.headers["X-Photo-Upload-Token"])
      .send(image);
    assert.equal(uploadResponse.status, 204);

    const confirmation = await request(app)
      .post(`/api/v1/property-photo-batches/${batchId}/photos/confirm`)
      .set("Authorization", `Bearer ${partnerToken}`)
      .send({
        storageKey: upload.storageKey,
        altText: `Live photo ${index + 1}`,
      });
    assert.equal(confirmation.status, 201);
    batchUploadIds.push(confirmation.body.data.upload.id as string);
  }

  const coverUploadId = batchUploadIds[1]!;
  const created = await request(app)
    .post("/api/v1/properties")
    .set("Authorization", `Bearer ${partnerToken}`)
    .send({
      ...createPropertyPayload(),
      photoBatchId: batchId,
      coverUploadId,
    });

  assert.equal(created.status, 201);
  const propertyId = created.body.data.property.id as number;
  propertyIds.push(propertyId);
  const propertyCode = created.body.data.property.code as string;
  assert.match(propertyCode, /^HK-\d{4,}$/);
  assert.equal(created.body.data.property.agentId, partner.id);
  assert.equal(created.body.data.property.photos.length, 5);
  assert.equal(
    created.body.data.property.photos.filter(
      (photo: { isCover: boolean }) => photo.isCover,
    ).length,
    1,
  );

  const byCode = await request(app)
    .get(`/api/v1/properties?code=${propertyCode.slice(3)}`)
    .set("Authorization", `Bearer ${partnerToken}`);
  assert.equal(byCode.status, 200);
  assert.equal(
    byCode.body.data.properties.some(
      (property: { id: number }) => property.id === propertyId,
    ),
    true,
  );

  const list = await request(app)
    .get("/api/v1/properties?search=Live&city=Valencia")
    .set("Authorization", `Bearer ${partnerToken}`);
  assert.equal(list.status, 200);
  assert.equal(
    list.body.data.properties.some(
      (property: { id: number }) => property.id === propertyId,
    ),
    true,
  );

  const updated = await request(app)
    .patch(`/api/v1/properties/${propertyId}`)
    .set("Authorization", `Bearer ${partnerToken}`)
    .send({ price: 175000.5, latitude: 10.2, longitude: -68.2 });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.data.property.price, "175000.50");

  const content = await request(app)
    .get(
      `/api/v1/properties/${propertyId}/photos/${created.body.data.property.photos[0].id}/content`,
    )
    .set("Authorization", `Bearer ${partnerToken}`);
  assert.equal(content.status, 200);
  assert.equal(content.headers["content-type"], "image/webp");

  const extraImage = await sharp({
    create: {
      width: 40,
      height: 30,
      channels: 3,
      background: { r: 200, g: 80, b: 20 },
    },
  })
    .jpeg()
    .toBuffer();
  const extraTarget = await request(app)
    .post(`/api/v1/properties/${propertyId}/photos/upload-url`)
    .set("Authorization", `Bearer ${partnerToken}`)
    .send({ mimeType: "image/jpeg", sizeBytes: extraImage.byteLength });
  assert.equal(extraTarget.status, 200);

  const extraUpload = extraTarget.body.data.upload;
  const extraUploadResponse = await request(app)
    .put(extraUpload.url)
    .set("Content-Type", "image/jpeg")
    .set("X-Photo-Upload-Token", extraUpload.headers["X-Photo-Upload-Token"])
    .send(extraImage);
  assert.equal(extraUploadResponse.status, 204);

  const extraConfirmation = await request(app)
    .post(`/api/v1/properties/${propertyId}/photos/confirm`)
    .set("Authorization", `Bearer ${partnerToken}`)
    .send({ storageKey: extraUpload.storageKey, altText: "Live extra" });
  assert.equal(extraConfirmation.status, 201);
  const extraPhotoId = extraConfirmation.body.data.photo.id as number;
  photoIds.push(extraPhotoId);

  const removedId = created.body.data.property.photos.find(
    (photo: { isCover: boolean }) => !photo.isCover,
  ).id as number;
  const allowedDeletion = await request(app)
    .delete(`/api/v1/properties/${propertyId}/photos/${removedId}`)
    .set("Authorization", `Bearer ${partnerToken}`);
  assert.equal(allowedDeletion.status, 200);

  const blockedDeletion = await request(app)
    .delete(`/api/v1/properties/${propertyId}/photos/${extraPhotoId}`)
    .set("Authorization", `Bearer ${partnerToken}`);
  assert.equal(blockedDeletion.status, 409);
  assert.equal(blockedDeletion.body.code, "MINIMUM_PHOTOS_REQUIRED");

  const closed = await request(app)
    .patch(`/api/v1/properties/${propertyId}`)
    .set("Authorization", `Bearer ${partnerToken}`)
    .send({ status: "CLOSED" });
  assert.equal(closed.status, 200);
  assert.notEqual(closed.body.data.property.closedAt, null);

  const reopened = await request(app)
    .patch(`/api/v1/properties/${propertyId}`)
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ status: "ACTIVE" });
  assert.equal(reopened.status, 200);
  assert.equal(reopened.body.data.property.closedAt, null);

  const deleted = await request(app)
    .delete(`/api/v1/properties/${propertyId}`)
    .set("Authorization", `Bearer ${adminToken}`);
  assert.equal(deleted.status, 200);
  assert.equal(deleted.body.data.deletedId, propertyId);

  const hidden = await request(app)
    .get(`/api/v1/properties/${propertyId}`)
    .set("Authorization", `Bearer ${adminToken}`);
  assert.equal(hidden.status, 404);

  console.log("Property capture live check completed successfully.");
};

const execute = async (): Promise<void> => {
  try {
    await run();
  } catch (error) {
    console.error("Property capture live check failed.", error);
    process.exitCode = 1;
  } finally {
    try {
      await cleanup();
    } catch (error) {
      console.error("Property capture live cleanup failed.", error);
      process.exitCode = 1;
    }

    setObjectStorageForTesting(null);
    await prisma.$disconnect();
  }
};

void execute();
