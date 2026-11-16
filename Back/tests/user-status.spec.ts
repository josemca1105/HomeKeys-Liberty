import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { Role } from "@prisma/client";
import type { Express } from "express";
import request from "supertest";
import { createApp } from "../src/app";
import type { OutgoingMail } from "../src/utils/mailer";
import { setMailSenderForTesting } from "../src/utils/mailer";
import {
  createMockDatabase,
  TEST_ADMIN_PASSWORD,
  TEST_PARTNER_PASSWORD,
} from "./helpers/mock-database";
import type { MockDatabase } from "./helpers/mock-database";

describe("Account status HTTP integration", { concurrency: false }, () => {
  let app: Express;
  let database: MockDatabase;
  let adminToken: string;

  beforeEach(async () => {
    database = createMockDatabase();
    app = createApp();

    setMailSenderForTesting({
      sendMail: async (options: OutgoingMail): Promise<unknown> => {
        return { accepted: [options.to] };
      },
    });

    adminToken = await login("admin@example.com", TEST_ADMIN_PASSWORD);
  });

  afterEach(() => {
    setMailSenderForTesting(null);
  });

  const login = async (email: string, password: string): Promise<string> => {
    const response = await request(app)
      .post("/api/v1/auth/login")
      .send({ email, password });

    assert.equal(response.status, 200);
    return response.body.data.token as string;
  };

  const deactivate = async (userId: number): Promise<request.Response> => {
    return request(app)
      .patch(`/api/v1/users/${userId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ isActive: false });
  };

  it("deactivates a user and blocks existing sessions and future logins", async () => {
    const partnerToken = await login(
      "partner@example.com",
      TEST_PARTNER_PASSWORD,
    );

    const response = await deactivate(2);

    assert.equal(response.status, 200);
    assert.equal(response.body.data.user.isActive, false);

    const sessionResponse = await request(app)
      .get("/api/v1/users/me")
      .set("Authorization", `Bearer ${partnerToken}`);

    assert.equal(sessionResponse.status, 403);
    assert.equal(sessionResponse.body.code, "ACCOUNT_INACTIVE");

    const loginResponse = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "partner@example.com", password: TEST_PARTNER_PASSWORD });

    assert.equal(loginResponse.status, 403);
    assert.equal(loginResponse.body.code, "ACCOUNT_INACTIVE");
  });

  it("keeps the generic credentials error for wrong passwords on inactive accounts", async () => {
    await deactivate(2);

    const response = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "partner@example.com", password: "Wrong-Password1!" });

    assert.equal(response.status, 401);
    assert.equal(response.body.code, "INVALID_CREDENTIALS");
  });

  it("reactivates a user and invalidates sessions issued before the deactivation", async () => {
    const partnerToken = await login(
      "partner@example.com",
      TEST_PARTNER_PASSWORD,
    );

    await deactivate(2);

    const reactivationResponse = await request(app)
      .patch("/api/v1/users/2")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ isActive: true });

    assert.equal(reactivationResponse.status, 200);
    assert.equal(reactivationResponse.body.data.user.isActive, true);

    const oldSessionResponse = await request(app)
      .get("/api/v1/users/me")
      .set("Authorization", `Bearer ${partnerToken}`);

    assert.equal(oldSessionResponse.status, 401);
    assert.equal(oldSessionResponse.body.code, "SESSION_INVALIDATED");

    const freshToken = await login(
      "partner@example.com",
      TEST_PARTNER_PASSWORD,
    );
    assert.equal(typeof freshToken, "string");
  });

  it("blocks administrators from deactivating their own account", async () => {
    const response = await deactivate(1);

    assert.equal(response.status, 409);
    assert.equal(response.body.code, "SELF_DEACTIVATION_NOT_ALLOWED");
  });

  it("prevents leaving the system without an active administrator", async () => {
    database.addUser({
      id: 3,
      email: "second-admin@example.com",
      role: Role.ADMIN,
      password: "Second-Admin-Password1!",
    });

    const deactivationResponse = await deactivate(3);
    assert.equal(deactivationResponse.status, 200);

    // The acting admin is now the only active administrator: demoting itself
    // must be rejected even though another (inactive) admin row exists.
    const demotionResponse = await request(app)
      .patch("/api/v1/users/1")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ role: Role.PARTNER });

    assert.equal(demotionResponse.status, 409);
    assert.equal(demotionResponse.body.code, "LAST_ADMIN_REQUIRED");
  });

  it("rejects invalid account status values", async () => {
    const response = await request(app)
      .patch("/api/v1/users/2")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ isActive: "yes" });

    assert.equal(response.status, 400);
    assert.equal(response.body.code, "VALIDATION_ERROR");
  });

  it("filters the user list by account status", async () => {
    await deactivate(2);

    const inactiveResponse = await request(app)
      .get("/api/v1/users?isActive=false")
      .set("Authorization", `Bearer ${adminToken}`);

    assert.equal(inactiveResponse.status, 200);
    assert.equal(
      inactiveResponse.body.data.users.every(
        (user: { isActive: boolean }) => user.isActive === false,
      ),
      true,
    );
    assert.equal(
      inactiveResponse.body.data.users.some(
        (user: { id: number }) => user.id === 2,
      ),
      true,
    );

    const activeResponse = await request(app)
      .get("/api/v1/users?isActive=true")
      .set("Authorization", `Bearer ${adminToken}`);

    assert.equal(activeResponse.status, 200);
    assert.equal(
      activeResponse.body.data.users.every(
        (user: { isActive: boolean }) => user.isActive === true,
      ),
      true,
    );
    assert.equal(
      activeResponse.body.data.users.some(
        (user: { id: number }) => user.id === 2,
      ),
      false,
    );

    const invalidResponse = await request(app)
      .get("/api/v1/users?isActive=maybe")
      .set("Authorization", `Bearer ${adminToken}`);

    assert.equal(invalidResponse.status, 400);
    assert.equal(invalidResponse.body.code, "VALIDATION_ERROR");
  });

  it("exposes the account status in user DTOs without leaking credentials", async () => {
    const response = await request(app)
      .get("/api/v1/users/2")
      .set("Authorization", `Bearer ${adminToken}`);

    assert.equal(response.status, 200);
    assert.equal(response.body.data.user.isActive, true);
    assert.equal("passwordHash" in response.body.data.user, false);
  });
});
