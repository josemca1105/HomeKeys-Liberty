import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { AuditScope, PropertyStatus, Role } from "@prisma/client";
import type { Express } from "express";
import request from "supertest";
import { createApp } from "../src/app";
import {
  createMockDatabase,
  TEST_ADMIN_PASSWORD,
  TEST_NEW_USER_PASSWORD,
  TEST_PARTNER_PASSWORD,
} from "./helpers/mock-database";
import type { MockDatabase } from "./helpers/mock-database";

const createPropertyPayload = (
  overrides: Record<string, unknown> = {},
): Record<string, unknown> => {
  return {
    title: "Casa familiar en El Viñedo",
    propertyType: "HOUSE",
    listingType: "SALE",
    description: "Casa remodelada con patio amplio.",
    ownerName: "María Pérez",
    ownerPhone: "0414-1234567",
    ownerEmail: "owner@example.com",
    address: "Av. Bolívar Norte, casa 12",
    neighborhood: "El Viñedo",
    city: "Valencia",
    state: "Carabobo",
    latitude: 10.1234567,
    longitude: -68.1234567,
    price: 150000.5,
    maintenanceFee: 80,
    isNegotiable: true,
    bedrooms: 3,
    bathrooms: 2,
    parkingSpaces: 2,
    squareMeters: 120.5,
    lotSquareMeters: 200,
    yearBuilt: 2010,
    apartmentFloor: 2,
    hasWaterTank: true,
    hasPowerPlant: true,
    isFurnished: false,
    allowsPets: true,
    hasPool: false,
    hasGym: false,
    hasBalcony: true,
    hasAirConditioning: true,
    hasSecurity: true,
    hasElevator: true,
    videoUrl: "https://videos.example.com/property/1",
    virtualTourUrl: "https://tours.example.com/property/1",
    ...overrides,
  };
};

describe("Property capture CRUD HTTP integration", { concurrency: false }, () => {
  let app: Express;
  let database: MockDatabase;
  let adminToken: string;
  let partnerToken: string;

  beforeEach(async () => {
    database = createMockDatabase();
    app = createApp();

    adminToken = await login("admin@example.com", TEST_ADMIN_PASSWORD);
    partnerToken = await login("partner@example.com", TEST_PARTNER_PASSWORD);
  });

  const login = async (email: string, password: string): Promise<string> => {
    const response = await request(app)
      .post("/api/v1/auth/login")
      .send({ email, password });

    assert.equal(response.status, 200);
    return response.body.data.token as string;
  };

  const addPartner = async (id: number, email: string): Promise<string> => {
    database.addUser({
      id,
      email,
      role: Role.PARTNER,
      password: TEST_NEW_USER_PASSWORD,
    });

    return login(email, TEST_NEW_USER_PASSWORD);
  };

  const createAsPartner = async (
    overrides: Record<string, unknown> = {},
  ): Promise<request.Response> => {
    return request(app)
      .post("/api/v1/properties")
      .set("Authorization", `Bearer ${partnerToken}`)
      .send(createPropertyPayload(overrides));
  };

  const createAsAdmin = async (
    agentId: number,
    overrides: Record<string, unknown> = {},
  ): Promise<request.Response> => {
    return request(app)
      .post("/api/v1/properties")
      .set("Authorization", `Bearer ${adminToken}`)
      .send(createPropertyPayload({ agentId, ...overrides }));
  };

  it("lets a PARTNER create its own complete capture", async () => {
    const response = await createAsPartner();

    assert.equal(response.status, 201);
    const property = response.body.data.property;

    assert.equal(property.agentId, 2);
    assert.match(property.code, /^HK-\d{4}-\d{6}$/);
    assert.equal(property.status, PropertyStatus.ACTIVE);
    assert.equal(property.currency, "USD");
    assert.equal(property.price, "150000.50");
    assert.equal(property.maintenanceFee, "80.00");
    assert.equal(property.squareMeters, "120.50");
    assert.equal(property.lotSquareMeters, "200.00");
    assert.equal(property.latitude, 10.1234567);
    assert.equal(property.longitude, -68.1234567);
    assert.equal(property.hasWaterTank, true);
    assert.equal(property.allowsPets, true);
    assert.equal(property.isFurnished, false);
    assert.equal(property.videoUrl, "https://videos.example.com/property/1");
    assert.equal(!("passwordHash" in property), true);

    assert.equal(database.properties.length, 1);
    assert.equal(
      database.auditLogs.some(
        (log) =>
          log.scope === AuditScope.BUSINESS &&
          log.action === "PROPERTY_CREATED" &&
          log.entityId === property.id,
      ),
      true,
    );
  });

  it("generates unique sequential codes", async () => {
    const first = await createAsPartner({ title: "Primera" });
    const second = await createAsPartner({ title: "Segunda" });

    assert.equal(first.status, 201);
    assert.equal(second.status, 201);
    assert.notEqual(
      first.body.data.property.code,
      second.body.data.property.code,
    );
  });

  it("requires ADMIN to select an active PARTNER and forbids PARTNER assignment", async () => {
    const missingAgent = await request(app)
      .post("/api/v1/properties")
      .set("Authorization", `Bearer ${adminToken}`)
      .send(createPropertyPayload());

    assert.equal(missingAgent.status, 400);
    assert.equal(missingAgent.body.code, "PROPERTY_AGENT_REQUIRED");

    const partnerAttempt = await createAsPartner({ agentId: 1 });
    assert.equal(partnerAttempt.status, 403);
    assert.equal(
      partnerAttempt.body.code,
      "PROPERTY_AGENT_ASSIGNMENT_FORBIDDEN",
    );

    const createdForPartner = await createAsAdmin(2);
    assert.equal(createdForPartner.status, 201);
    assert.equal(createdForPartner.body.data.property.agentId, 2);
  });

  it("rejects invalid agents and inactive PARTNERs", async () => {
    const invalidAgent = await createAsAdmin(1);
    assert.equal(invalidAgent.status, 422);
    assert.equal(invalidAgent.body.code, "INVALID_PROPERTY_AGENT");

    await addPartner(3, "inactive@example.com");
    const deactivate = await request(app)
      .patch("/api/v1/users/3")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ isActive: false });
    assert.equal(deactivate.status, 200);

    const inactiveAgent = await createAsAdmin(3);
    assert.equal(inactiveAgent.status, 409);
    assert.equal(inactiveAgent.body.code, "PROPERTY_AGENT_INACTIVE");
  });

  it("rejects incomplete, unknown, unsafe and out-of-range fields", async () => {
    const incomplete = await request(app)
      .post("/api/v1/properties")
      .set("Authorization", `Bearer ${partnerToken}`)
      .send({ title: "Incompleta" });

    assert.equal(incomplete.status, 400);
    assert.equal(incomplete.body.code, "VALIDATION_ERROR");
    assert.equal(
      incomplete.body.errors.some(
        (error: { field: string }) => error.field === "latitude",
      ),
      true,
    );

    const unknownField = await createAsPartner({ code: "HK-2026-000001" });
    assert.equal(unknownField.status, 400);
    assert.equal(unknownField.body.code, "VALIDATION_ERROR");

    const invalidCoordinates = await createAsPartner({ latitude: 91 });
    assert.equal(invalidCoordinates.status, 400);

    const insecureVideo = await createAsPartner({
      videoUrl: "http://videos.example.com/property/1",
    });
    assert.equal(insecureVideo.status, 400);

    const negativePrice = await createAsPartner({ price: -1 });
    assert.equal(negativePrice.status, 400);

    const futureYear = await createAsPartner({
      yearBuilt: new Date().getFullYear() + 1,
    });
    assert.equal(futureYear.status, 400);
  });

  it("limits reads to the owning PARTNER and ADMIN", async () => {
    const created = await createAsPartner();
    const propertyId = created.body.data.property.id as number;
    const otherPartnerToken = await addPartner(3, "other@example.com");

    const ownerRead = await request(app)
      .get(`/api/v1/properties/${propertyId}`)
      .set("Authorization", `Bearer ${partnerToken}`);
    assert.equal(ownerRead.status, 200);

    const adminRead = await request(app)
      .get(`/api/v1/properties/${propertyId}`)
      .set("Authorization", `Bearer ${adminToken}`);
    assert.equal(adminRead.status, 200);

    const foreignRead = await request(app)
      .get(`/api/v1/properties/${propertyId}`)
      .set("Authorization", `Bearer ${otherPartnerToken}`);
    assert.equal(foreignRead.status, 404);
    assert.equal(foreignRead.body.code, "PROPERTY_NOT_FOUND");

    const unauthenticated = await request(app).get(
      `/api/v1/properties/${propertyId}`,
    );
    assert.equal(unauthenticated.status, 401);

    const invalidId = await request(app)
      .get("/api/v1/properties/not-a-number")
      .set("Authorization", `Bearer ${partnerToken}`);
    assert.equal(invalidId.status, 400);

    const missing = await request(app)
      .get("/api/v1/properties/9999")
      .set("Authorization", `Bearer ${partnerToken}`);
    assert.equal(missing.status, 404);
  });

  it("updates capture data and coordinates while serializing decimals", async () => {
    const created = await createAsPartner();
    const propertyId = created.body.data.property.id as number;

    const response = await request(app)
      .patch(`/api/v1/properties/${propertyId}`)
      .set("Authorization", `Bearer ${partnerToken}`)
      .send({
        title: "Casa actualizada",
        price: 175000.25,
        maintenanceFee: null,
        latitude: 10.5555555,
        longitude: -68.5555555,
        hasPool: true,
        description: null,
      });

    assert.equal(response.status, 200);
    const property = response.body.data.property;
    assert.equal(property.title, "Casa actualizada");
    assert.equal(property.price, "175000.25");
    assert.equal(property.maintenanceFee, null);
    assert.equal(property.latitude, 10.5555555);
    assert.equal(property.longitude, -68.5555555);
    assert.equal(property.hasPool, true);
    assert.equal(property.description, null);

    assert.equal(
      database.auditLogs.some(
        (log) =>
          log.action === "PROPERTY_UPDATED" &&
          log.entityId === propertyId,
      ),
      true,
    );
  });

  it("requires latitude and longitude updates together", async () => {
    const created = await createAsPartner();
    const propertyId = created.body.data.property.id as number;

    const response = await request(app)
      .patch(`/api/v1/properties/${propertyId}`)
      .set("Authorization", `Bearer ${partnerToken}`)
      .send({ latitude: 10.5 });

    assert.equal(response.status, 400);
    assert.equal(response.body.code, "VALIDATION_ERROR");
  });

  it("allows PAUSED and CLOSED transitions and protects closed captures", async () => {
    const created = await createAsPartner();
    const propertyId = created.body.data.property.id as number;

    const paused = await request(app)
      .patch(`/api/v1/properties/${propertyId}`)
      .set("Authorization", `Bearer ${partnerToken}`)
      .send({ status: "PAUSED" });
    assert.equal(paused.status, 200);
    assert.equal(paused.body.data.property.status, "PAUSED");
    assert.equal(paused.body.data.property.closedAt, null);

    const closed = await request(app)
      .patch(`/api/v1/properties/${propertyId}`)
      .set("Authorization", `Bearer ${partnerToken}`)
      .send({ status: "CLOSED" });
    assert.equal(closed.status, 200);
    assert.equal(closed.body.data.property.status, "CLOSED");
    assert.notEqual(closed.body.data.property.closedAt, null);

    const closedEdit = await request(app)
      .patch(`/api/v1/properties/${propertyId}`)
      .set("Authorization", `Bearer ${partnerToken}`)
      .send({ title: "No permitido" });
    assert.equal(closedEdit.status, 409);
    assert.equal(closedEdit.body.code, "PROPERTY_CLOSED");

    const closedReopen = await request(app)
      .patch(`/api/v1/properties/${propertyId}`)
      .set("Authorization", `Bearer ${partnerToken}`)
      .send({ status: "ACTIVE" });
    assert.equal(closedReopen.status, 409);
    assert.equal(closedReopen.body.code, "PROPERTY_CLOSED");

    const adminReopen = await request(app)
      .patch(`/api/v1/properties/${propertyId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "ACTIVE" });
    assert.equal(adminReopen.status, 200);
    assert.equal(adminReopen.body.data.property.status, "ACTIVE");
    assert.equal(adminReopen.body.data.property.closedAt, null);

    assert.equal(
      database.auditLogs.filter(
        (log) => log.action === "PROPERTY_STATUS_CHANGED",
      ).length,
      3,
    );
  });

  it("lets ADMIN reassign a capture and moves ownership", async () => {
    const created = await createAsPartner();
    const propertyId = created.body.data.property.id as number;
    const nextPartnerToken = await addPartner(3, "next-partner@example.com");

    const assigned = await request(app)
      .patch(`/api/v1/properties/${propertyId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ agentId: 3 });
    assert.equal(assigned.status, 200);
    assert.equal(assigned.body.data.property.agentId, 3);

    const previousOwnerRead = await request(app)
      .get(`/api/v1/properties/${propertyId}`)
      .set("Authorization", `Bearer ${partnerToken}`);
    assert.equal(previousOwnerRead.status, 404);

    const newOwnerRead = await request(app)
      .get(`/api/v1/properties/${propertyId}`)
      .set("Authorization", `Bearer ${nextPartnerToken}`);
    assert.equal(newOwnerRead.status, 200);

    const partnerReassignment = await request(app)
      .patch(`/api/v1/properties/${propertyId}`)
      .set("Authorization", `Bearer ${nextPartnerToken}`)
      .send({ agentId: 2 });
    assert.equal(partnerReassignment.status, 403);
    assert.equal(
      partnerReassignment.body.code,
      "PROPERTY_AGENT_ASSIGNMENT_FORBIDDEN",
    );

    const invalidReassignment = await request(app)
      .patch(`/api/v1/properties/${propertyId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ agentId: 1 });
    assert.equal(invalidReassignment.status, 422);
    assert.equal(invalidReassignment.body.code, "INVALID_PROPERTY_AGENT");

    assert.equal(
      database.auditLogs.some(
        (log) =>
          log.action === "PROPERTY_REASSIGNED" &&
          log.entityId === propertyId,
      ),
      true,
    );
  });

  it("allows only ADMIN to soft delete and hides the capture", async () => {
    const created = await createAsPartner();
    const propertyId = created.body.data.property.id as number;

    const partnerDelete = await request(app)
      .delete(`/api/v1/properties/${propertyId}`)
      .set("Authorization", `Bearer ${partnerToken}`);
    assert.equal(partnerDelete.status, 403);
    assert.equal(partnerDelete.body.code, "ADMIN_REQUIRED");

    const adminDelete = await request(app)
      .delete(`/api/v1/properties/${propertyId}`)
      .set("Authorization", `Bearer ${adminToken}`);
    assert.equal(adminDelete.status, 200);
    assert.equal(adminDelete.body.data.deletedId, propertyId);
    assert.notEqual(database.properties[0]?.deletedAt, null);

    const readAfterDelete = await request(app)
      .get(`/api/v1/properties/${propertyId}`)
      .set("Authorization", `Bearer ${adminToken}`);
    assert.equal(readAfterDelete.status, 404);

    const repeatedDelete = await request(app)
      .delete(`/api/v1/properties/${propertyId}`)
      .set("Authorization", `Bearer ${adminToken}`);
    assert.equal(repeatedDelete.status, 404);

    assert.equal(
      database.auditLogs.some(
        (log) =>
          log.action === "PROPERTY_DELETED" &&
          log.entityId === propertyId,
      ),
      true,
    );
  });

  it("blocks deactivation while a PARTNER has open captures", async () => {
    const created = await createAsPartner();
    assert.equal(created.status, 201);

    const blocked = await request(app)
      .patch("/api/v1/users/2")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ isActive: false });

    assert.equal(blocked.status, 409);
    assert.equal(blocked.body.code, "USER_HAS_OPEN_PROPERTIES");
    assert.equal(database.users[1]?.isActive, true);
  });

  it("allows deactivation after all captures are closed", async () => {
    const created = await createAsPartner();
    const propertyId = created.body.data.property.id as number;

    const closed = await request(app)
      .patch(`/api/v1/properties/${propertyId}`)
      .set("Authorization", `Bearer ${partnerToken}`)
      .send({ status: "CLOSED" });
    assert.equal(closed.status, 200);

    const deactivated = await request(app)
      .patch("/api/v1/users/2")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ isActive: false });

    assert.equal(deactivated.status, 200);
    assert.equal(deactivated.body.data.user.isActive, false);
  });
});
