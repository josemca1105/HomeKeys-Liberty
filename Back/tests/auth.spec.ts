import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { Role } from "@prisma/client";
import type { Express } from "express";
import bcrypt from "bcrypt";
import request from "supertest";
import { createApp } from "../src/app";
import {
  createMockDatabase,
  TEST_ADMIN_PASSWORD,
  TEST_NEW_USER_PASSWORD,
  TEST_PARTNER_PASSWORD,
} from "./helpers/mock-database";
import type { MockDatabase } from "./helpers/mock-database";

const buildCreateUserPayload = (
  email: string,
  role?: Role,
): Record<string, unknown> => {
  return {
    firstName: "Test",
    lastName: "User",
    email,
    password: TEST_NEW_USER_PASSWORD,
    phone: "00000000",
    photoUrl: null,
    ...(role ? { role } : {}),
  };
};

describe("Authentication and authorization HTTP integration", { concurrency: false }, () => {
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
    assert.equal(typeof response.body.data.token, "string");
    return response.body.data.token as string;
  };

  it("authenticates an administrator without exposing the password hash", async () => {
    const response = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "admin@example.com", password: TEST_ADMIN_PASSWORD });

    assert.equal(response.status, 200);
    assert.equal(response.body.data.user.role, Role.ADMIN);
    assert.equal("passwordHash" in response.body.data.user, false);
    assert.equal(typeof response.body.data.token, "string");
  });

  it("returns the same credentials error for an unknown email", async () => {
    const response = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "unknown@example.com", password: "Wrong-Password1!" });

    assert.equal(response.status, 401);
    assert.equal(response.body.code, "INVALID_CREDENTIALS");
  });

  it("allows an administrator to create a PARTNER with a hashed password", async () => {
    const adminToken = await login("admin@example.com", TEST_ADMIN_PASSWORD);

    const response = await request(app)
      .post("/api/v1/users/add")
      .set("Authorization", `Bearer ${adminToken}`)
      .send(buildCreateUserPayload("new-partner@example.com"));

    assert.equal(response.status, 201);
    assert.equal(response.body.data.user.role, Role.PARTNER);
    assert.equal("passwordHash" in response.body.data.user, false);

    const createdUser = database.users.find(
      (user) => user.email === "new-partner@example.com",
    );
    assert.ok(createdUser);
    assert.equal(
      await bcrypt.compare(TEST_NEW_USER_PASSWORD, createdUser.passwordHash),
      true,
    );
    assert.equal(database.getUserCreateCallCount(), 1);
  });

  it("rejects a duplicate email before creating a user", async () => {
    const adminToken = await login("admin@example.com", TEST_ADMIN_PASSWORD);

    const response = await request(app)
      .post("/api/v1/users/add")
      .set("Authorization", `Bearer ${adminToken}`)
      .send(buildCreateUserPayload("partner@example.com"));

    assert.equal(response.status, 409);
    assert.equal(response.body.code, "EMAIL_ALREADY_REGISTERED");
    assert.equal(database.getUserCreateCallCount(), 0);
  });

  it("maps a unique constraint race to the duplicate email response", async () => {
    const adminToken = await login("admin@example.com", TEST_ADMIN_PASSWORD);
    database.failNextUserCreateWithDuplicateEmail();

    const response = await request(app)
      .post("/api/v1/users/add")
      .set("Authorization", `Bearer ${adminToken}`)
      .send(buildCreateUserPayload("race-condition@example.com"));

    assert.equal(response.status, 409);
    assert.equal(response.body.code, "EMAIL_ALREADY_REGISTERED");
  });

  it("blocks a PARTNER from creating another PARTNER", async () => {
    const partnerToken = await login(
      "partner@example.com",
      TEST_PARTNER_PASSWORD,
    );

    const response = await request(app)
      .post("/api/v1/users/add")
      .set("Authorization", `Bearer ${partnerToken}`)
      .send(buildCreateUserPayload("blocked-partner@example.com"));

    assert.equal(response.status, 403);
    assert.equal(response.body.code, "ADMIN_REQUIRED");
    assert.equal(database.getUserCreateCallCount(), 0);
    assert.equal(database.users.length, 2);
  });

  it("blocks a PARTNER from creating an ADMIN", async () => {
    const partnerToken = await login(
      "partner@example.com",
      TEST_PARTNER_PASSWORD,
    );

    const response = await request(app)
      .post("/api/v1/users/add")
      .set("Authorization", `Bearer ${partnerToken}`)
      .send(buildCreateUserPayload("blocked-admin@example.com", Role.ADMIN));

    assert.equal(response.status, 403);
    assert.equal(response.body.code, "ADMIN_REQUIRED");
    assert.equal(database.getUserCreateCallCount(), 0);
    assert.equal(database.users.length, 2);
  });

  it("uses the current database role instead of the JWT role", async () => {
    const adminToken = await login("admin@example.com", TEST_ADMIN_PASSWORD);
    const administrator = database.users.find((user) => user.id === 1);
    assert.ok(administrator);
    administrator.role = Role.PARTNER;

    const response = await request(app)
      .post("/api/v1/users/add")
      .set("Authorization", `Bearer ${adminToken}`)
      .send(buildCreateUserPayload("role-change@example.com"));

    assert.equal(response.status, 403);
    assert.equal(response.body.code, "ADMIN_REQUIRED");
    assert.equal(database.getUserCreateCallCount(), 0);
  });

  it("rejects a token when its user no longer exists", async () => {
    const adminToken = await login("admin@example.com", TEST_ADMIN_PASSWORD);
    database.users.splice(0, 1);

    const response = await request(app)
      .post("/api/v1/users/add")
      .set("Authorization", `Bearer ${adminToken}`)
      .send(buildCreateUserPayload("deleted-user@example.com"));

    assert.equal(response.status, 401);
    assert.equal(response.body.code, "INVALID_SESSION");
    assert.equal(database.getUserCreateCallCount(), 0);
  });

  it("revokes a token on logout and rejects its reuse", async () => {
    const adminToken = await login("admin@example.com", TEST_ADMIN_PASSWORD);

    const logoutResponse = await request(app)
      .post("/api/v1/auth/logout")
      .set("Authorization", `Bearer ${adminToken}`);

    assert.equal(logoutResponse.status, 200);
    assert.equal(database.revokedTokens.length, 1);

    const response = await request(app)
      .post("/api/v1/users/add")
      .set("Authorization", `Bearer ${adminToken}`)
      .send(buildCreateUserPayload("revoked-token@example.com"));

    assert.equal(response.status, 401);
    assert.equal(response.body.code, "SESSION_REVOKED");
    assert.equal(database.getUserCreateCallCount(), 0);
  });

  it("rejects passwords that exceed the bcrypt UTF-8 byte limit", async () => {
    const adminToken = await login("admin@example.com", TEST_ADMIN_PASSWORD);
    const payload = buildCreateUserPayload("long-password@example.com");
    payload.password = "é".repeat(72);

    const response = await request(app)
      .post("/api/v1/users/add")
      .set("Authorization", `Bearer ${adminToken}`)
      .send(payload);

    assert.equal(response.status, 400);
    assert.equal(response.body.code, "VALIDATION_ERROR");
    assert.equal(database.getUserCreateCallCount(), 0);
  });

  it("returns 413 when the JSON body exceeds the configured limit", async () => {
    const largeJsonBody = `{"email":"${"a".repeat(11 * 1024)}","password":"anything"}`;

    const response = await request(app)
      .post("/api/v1/auth/login")
      .set("Content-Type", "application/json")
      .send(largeJsonBody);

    assert.equal(response.status, 413);
    assert.equal(response.body.code, "PAYLOAD_TOO_LARGE");
  });
});
