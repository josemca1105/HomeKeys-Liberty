import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { Role } from "@prisma/client";
import type { Express } from "express";
import request from "supertest";
import { createApp } from "../src/app";
import {
  createMockDatabase,
  TEST_ADMIN_PASSWORD,
  TEST_PARTNER_PASSWORD,
} from "./helpers/mock-database";
import type { MockDatabase } from "./helpers/mock-database";

describe("User profile HTTP integration", { concurrency: false }, () => {
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

  it("allows ADMIN to list all users without exposing password hashes", async () => {
    const adminToken = await login("admin@example.com", TEST_ADMIN_PASSWORD);

    const response = await request(app)
      .get("/api/v1/users")
      .set("Authorization", `Bearer ${adminToken}`);

    assert.equal(response.status, 200);
    assert.equal(response.body.message, "Usuarios obtenidos exitosamente.");
    assert.equal(Array.isArray(response.body.data.users), true);
    assert.equal(response.body.data.users.length, 2);
    for (const user of response.body.data.users) {
      assert.equal("passwordHash" in user, false);
    }
  });

  it("returns an empty user list without treating it as a failure", async () => {
    const adminToken = await login("admin@example.com", TEST_ADMIN_PASSWORD);
    database.setEmptyUserList();

    const response = await request(app)
      .get("/api/v1/users")
      .set("Authorization", `Bearer ${adminToken}`);

    assert.equal(response.status, 200);
    assert.deepEqual(response.body.data.users, []);
  });

  it("blocks PARTNER from listing all users", async () => {
    const partnerToken = await login(
      "partner@example.com",
      TEST_PARTNER_PASSWORD,
    );

    const response = await request(app)
      .get("/api/v1/users")
      .set("Authorization", `Bearer ${partnerToken}`);

    assert.equal(response.status, 403);
    assert.equal(response.body.code, "ADMIN_REQUIRED");
    assert.equal(database.getUserFindManyCallCount(), 0);
  });

  it("requires authentication to list users", async () => {
    const response = await request(app).get("/api/v1/users");

    assert.equal(response.status, 401);
    assert.equal(response.body.code, "AUTHENTICATION_REQUIRED");
  });

  it("allows ADMIN to fetch its own profile through /users/me", async () => {
    const adminToken = await login("admin@example.com", TEST_ADMIN_PASSWORD);

    const response = await request(app)
      .get("/api/v1/users/me")
      .set("Authorization", `Bearer ${adminToken}`);

    assert.equal(response.status, 200);
    assert.equal(response.body.data.user.id, 1);
    assert.equal(response.body.data.user.role, Role.ADMIN);
    assert.equal("passwordHash" in response.body.data.user, false);
  });

  it("allows PARTNER to fetch its own profile through /users/me", async () => {
    const partnerToken = await login(
      "partner@example.com",
      TEST_PARTNER_PASSWORD,
    );

    const response = await request(app)
      .get("/api/v1/users/me")
      .set("Authorization", `Bearer ${partnerToken}`);

    assert.equal(response.status, 200);
    assert.equal(response.body.data.user.id, 2);
    assert.equal(response.body.data.user.role, Role.PARTNER);
    assert.equal("passwordHash" in response.body.data.user, false);
  });

  it("requires authentication for /users/me", async () => {
    const response = await request(app).get("/api/v1/users/me");

    assert.equal(response.status, 401);
    assert.equal(response.body.code, "AUTHENTICATION_REQUIRED");
  });

  it("returns the current role through /users/me after a role change", async () => {
    const adminToken = await login("admin@example.com", TEST_ADMIN_PASSWORD);
    const administrator = database.users.find((user) => user.id === 1);
    assert.ok(administrator);
    administrator.role = Role.PARTNER;

    const response = await request(app)
      .get("/api/v1/users/me")
      .set("Authorization", `Bearer ${adminToken}`);

    assert.equal(response.status, 200);
    assert.equal(response.body.data.user.role, Role.PARTNER);
  });

  it("allows ADMIN to fetch any user by ID", async () => {
    const adminToken = await login("admin@example.com", TEST_ADMIN_PASSWORD);

    const response = await request(app)
      .get("/api/v1/users/2")
      .set("Authorization", `Bearer ${adminToken}`);

    assert.equal(response.status, 200);
    assert.equal(response.body.data.user.id, 2);
    assert.equal(response.body.data.user.email, "partner@example.com");
    assert.equal("passwordHash" in response.body.data.user, false);
  });

  it("blocks PARTNER from fetching any user by ID", async () => {
    const partnerToken = await login(
      "partner@example.com",
      TEST_PARTNER_PASSWORD,
    );

    for (const userId of [2, 999]) {
      const response = await request(app)
        .get(`/api/v1/users/${userId}`)
        .set("Authorization", `Bearer ${partnerToken}`);

      assert.equal(response.status, 403);
      assert.equal(response.body.code, "ADMIN_REQUIRED");
    }
  });

  it("returns USER_NOT_FOUND to ADMIN for an unknown ID", async () => {
    const adminToken = await login("admin@example.com", TEST_ADMIN_PASSWORD);

    const response = await request(app)
      .get("/api/v1/users/999")
      .set("Authorization", `Bearer ${adminToken}`);

    assert.equal(response.status, 404);
    assert.equal(response.body.code, "USER_NOT_FOUND");
  });

  it("validates invalid user IDs before authorization", async () => {
    const adminToken = await login("admin@example.com", TEST_ADMIN_PASSWORD);

    for (const invalidId of ["abc", "0", "-1", "1.5"]) {
      const response = await request(app)
        .get(`/api/v1/users/${invalidId}`)
        .set("Authorization", `Bearer ${adminToken}`);

      assert.equal(response.status, 400);
      assert.equal(response.body.code, "VALIDATION_ERROR");
    }
  });

  it("uses the current role instead of the role stored in the JWT", async () => {
    const adminToken = await login("admin@example.com", TEST_ADMIN_PASSWORD);
    const administrator = database.users.find((user) => user.id === 1);
    assert.ok(administrator);
    administrator.role = Role.PARTNER;

    const response = await request(app)
      .get("/api/v1/users")
      .set("Authorization", `Bearer ${adminToken}`);

    assert.equal(response.status, 403);
    assert.equal(response.body.code, "ADMIN_REQUIRED");
    assert.equal(database.getUserFindManyCallCount(), 0);
  });
});
