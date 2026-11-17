import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import type { Express } from "express";
import request from "supertest";
import { createApp } from "../src/app";
import {
  createMockDatabase,
  TEST_ADMIN_PASSWORD,
  TEST_PARTNER_PASSWORD,
} from "./helpers/mock-database";
import type { MockDatabase } from "./helpers/mock-database";

describe("Self-service profile HTTP integration", { concurrency: false }, () => {
  let app: Express;
  let database: MockDatabase;

  beforeEach(() => {
    database = createMockDatabase();
    app = createApp();
  });

  const login = async (email: string, password: string): Promise<string> => {
    const response = await request(app)
      .post("/api/v1/auth/login")
      .send({ email, password });

    assert.equal(response.status, 200);
    return response.body.data.token as string;
  };

  it("allows a PARTNER to update its own names, phone and photo", async () => {
    const token = await login("partner@example.com", TEST_PARTNER_PASSWORD);

    const response = await request(app)
      .patch("/api/v1/users/me")
      .set("Authorization", `Bearer ${token}`)
      .send({
        firstName: "María",
        lastName: "González",
        phone: "+58 412-123 4567",
        photoUrl: "https://example.com/avatar.jpg",
      });

    assert.equal(response.status, 200);
    assert.equal(response.body.message, "Perfil actualizado exitosamente.");
    assert.equal(response.body.data.user.id, 2);
    assert.equal(response.body.data.user.firstName, "María");
    assert.equal(response.body.data.user.lastName, "González");
    assert.equal(response.body.data.user.phone, "+58 412-123 4567");
    assert.equal(
      response.body.data.user.photoUrl,
      "https://example.com/avatar.jpg",
    );
    assert.equal("passwordHash" in response.body.data.user, false);

    const auditLog = database.auditLogs.find(
      (log) => log.action === "USER_UPDATED",
    );
    assert.ok(auditLog);
    assert.equal(auditLog.actorId, 2);
    assert.equal(auditLog.entityId, 2);
    assert.equal(
      JSON.stringify(auditLog.changes).includes('"selfService":true'),
      true,
    );
  });

  it("allows an ADMIN to update its own profile", async () => {
    const token = await login("admin@example.com", TEST_ADMIN_PASSWORD);

    const response = await request(app)
      .patch("/api/v1/users/me")
      .set("Authorization", `Bearer ${token}`)
      .send({ phone: "04120000001" });

    assert.equal(response.status, 200);
    assert.equal(response.body.data.user.phone, "04120000001");
  });

  it("rejects fields that are not self-editable", async () => {
    const token = await login("partner@example.com", TEST_PARTNER_PASSWORD);

    const invalidBodies = [
      { email: "attacker@example.com" },
      { role: "ADMIN" },
      { isActive: false },
      { password: "Another-Password1!" },
    ];

    for (const body of invalidBodies) {
      const response = await request(app)
        .patch("/api/v1/users/me")
        .set("Authorization", `Bearer ${token}`)
        .send(body);

      assert.equal(response.status, 400);
      assert.equal(response.body.code, "VALIDATION_ERROR");
    }
  });

  it("rejects an empty body", async () => {
    const token = await login("partner@example.com", TEST_PARTNER_PASSWORD);

    const response = await request(app)
      .patch("/api/v1/users/me")
      .set("Authorization", `Bearer ${token}`)
      .send({});

    assert.equal(response.status, 400);
    assert.equal(response.body.code, "VALIDATION_ERROR");
  });

  it("validates names, phone numbers and photo URLs", async () => {
    const token = await login("partner@example.com", TEST_PARTNER_PASSWORD);

    const invalidBodies = [
      { firstName: "12345" },
      { phone: "abc12345" },
      { phone: "12345" },
      { photoUrl: "javascript:alert(1)" },
      { photoUrl: "http://127.0.0.1/avatar.jpg" },
    ];

    for (const body of invalidBodies) {
      const response = await request(app)
        .patch("/api/v1/users/me")
        .set("Authorization", `Bearer ${token}`)
        .send(body);

      assert.equal(response.status, 400);
      assert.equal(response.body.code, "VALIDATION_ERROR");
    }
  });

  it("requires authentication", async () => {
    const response = await request(app)
      .patch("/api/v1/users/me")
      .send({ firstName: "Anonymous" });

    assert.equal(response.status, 401);
  });

  it("blocks profile updates while a password change is required", async () => {
    const token = await login("partner@example.com", TEST_PARTNER_PASSWORD);
    const partner = database.users.find((user) => user.id === 2);
    assert.ok(partner);
    partner.mustChangePassword = true;

    const response = await request(app)
      .patch("/api/v1/users/me")
      .set("Authorization", `Bearer ${token}`)
      .send({ firstName: "Blocked" });

    assert.equal(response.status, 403);
    assert.equal(response.body.code, "PASSWORD_CHANGE_REQUIRED");
  });
});
