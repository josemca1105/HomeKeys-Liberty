import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { Role } from "@prisma/client";
import type { Express } from "express";
import jwt from "jsonwebtoken";
import request from "supertest";
import { createApp } from "../src/app";
import { environment } from "../src/config/env";
import {
  createMockDatabase,
  createPasswordResetTokenFixture,
  createRevokedTokenFixture,
  TEST_ADMIN_PASSWORD,
  TEST_CHANGED_PASSWORD,
  TEST_NEW_USER_PASSWORD,
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

describe("User management HTTP integration", { concurrency: false }, () => {
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

  const createExpiredToken = (): string => {
    const issuedAt = Math.floor(Date.now() / 1000) - 120;

    return jwt.sign(
      { role: Role.ADMIN, iat: issuedAt, exp: issuedAt + 60 },
      environment.JWT_SECRET,
      { subject: "1", noTimestamp: true },
    );
  };

  it("allows ADMIN to update names, email, phone, photo and role of any user", async () => {
    const adminToken = await login("admin@example.com", TEST_ADMIN_PASSWORD);

    const response = await request(app)
      .patch("/api/v1/users/2")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        firstName: "Nuevo",
        lastName: "Apellido",
        email: "NUEVO@Example.COM",
        phone: "04121234567",
        photoUrl: "https://example.com/photo.jpg",
        role: Role.ADMIN,
      });

    assert.equal(response.status, 200);
    assert.equal(response.body.message, "Usuario actualizado exitosamente.");
    assert.equal(response.body.data.user.id, 2);
    assert.equal(response.body.data.user.firstName, "Nuevo");
    assert.equal(response.body.data.user.lastName, "Apellido");
    assert.equal(response.body.data.user.email, "nuevo@example.com");
    assert.equal(response.body.data.user.phone, "04121234567");
    assert.equal(
      response.body.data.user.photoUrl,
      "https://example.com/photo.jpg",
    );
    assert.equal(response.body.data.user.role, Role.ADMIN);
    assert.equal("passwordHash" in response.body.data.user, false);

    const detailResponse = await request(app)
      .get("/api/v1/users/2")
      .set("Authorization", `Bearer ${adminToken}`);

    assert.equal(detailResponse.status, 200);
    assert.equal(detailResponse.body.data.user.email, "nuevo@example.com");
    assert.equal(detailResponse.body.data.user.role, Role.ADMIN);
  });

  it("allows ADMIN to reset another user's password and closes that user's sessions", async () => {
    const adminToken = await login("admin@example.com", TEST_ADMIN_PASSWORD);
    const partnerToken = await login(
      "partner@example.com",
      TEST_PARTNER_PASSWORD,
    );

    const response = await request(app)
      .patch("/api/v1/users/2")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ password: TEST_CHANGED_PASSWORD });

    assert.equal(response.status, 200);
    assert.equal(response.body.message, "Usuario actualizado exitosamente.");
    assert.equal(response.body.data.user.id, 2);
    assert.equal("passwordHash" in response.body.data.user, false);
    assert.equal("token" in response.body.data, false);

    const invalidatedResponse = await request(app)
      .get("/api/v1/users/me")
      .set("Authorization", `Bearer ${partnerToken}`);

    assert.equal(invalidatedResponse.status, 401);
    assert.equal(invalidatedResponse.body.code, "SESSION_INVALIDATED");

    const oldPasswordResponse = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "partner@example.com", password: TEST_PARTNER_PASSWORD });

    assert.equal(oldPasswordResponse.status, 401);
    assert.equal(oldPasswordResponse.body.code, "INVALID_CREDENTIALS");

    const newPasswordResponse = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "partner@example.com", password: TEST_CHANGED_PASSWORD });

    assert.equal(newPasswordResponse.status, 200);
    assert.equal("passwordHash" in newPasswordResponse.body.data.user, false);
  });

  it("returns a fresh token when ADMIN resets its own password through /users/:id", async () => {
    const adminToken = await login("admin@example.com", TEST_ADMIN_PASSWORD);

    const response = await request(app)
      .patch("/api/v1/users/1")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ password: TEST_CHANGED_PASSWORD });

    assert.equal(response.status, 200);
    assert.equal(response.body.data.user.id, 1);
    assert.equal(typeof response.body.data.token, "string");

    const freshSessionResponse = await request(app)
      .get("/api/v1/users/me")
      .set("Authorization", `Bearer ${response.body.data.token as string}`);

    assert.equal(freshSessionResponse.status, 200);
  });

  it("blocks PARTNER from using PATCH /users/:id", async () => {
    const partnerToken = await login(
      "partner@example.com",
      TEST_PARTNER_PASSWORD,
    );

    for (const userId of [1, 2, 999]) {
      const response = await request(app)
        .patch(`/api/v1/users/${userId}`)
        .set("Authorization", `Bearer ${partnerToken}`)
        .send({ firstName: "Hackeado" });

      assert.equal(response.status, 403);
      assert.equal(response.body.code, "ADMIN_REQUIRED");
    }

    const meResponse = await request(app)
      .get("/api/v1/users/me")
      .set("Authorization", `Bearer ${partnerToken}`);

    assert.equal(meResponse.body.data.user.firstName, "Test");
  });

  it("blocks PARTNER from changing another user's password", async () => {
    const partnerToken = await login(
      "partner@example.com",
      TEST_PARTNER_PASSWORD,
    );

    const response = await request(app)
      .patch("/api/v1/users/1")
      .set("Authorization", `Bearer ${partnerToken}`)
      .send({ password: TEST_CHANGED_PASSWORD });

    assert.equal(response.status, 403);
    assert.equal(response.body.code, "ADMIN_REQUIRED");

    const targetedResponse = await request(app)
      .patch("/api/v1/users/me/password")
      .set("Authorization", `Bearer ${partnerToken}`)
      .send({
        currentPassword: TEST_PARTNER_PASSWORD,
        newPassword: TEST_CHANGED_PASSWORD,
        userId: 1,
      });

    assert.equal(targetedResponse.status, 400);
    assert.equal(targetedResponse.body.code, "VALIDATION_ERROR");
  });

  it("allows PARTNER to change its own password and invalidates previous sessions", async () => {
    const partnerToken = await login(
      "partner@example.com",
      TEST_PARTNER_PASSWORD,
    );
    const otherSessionToken = await login(
      "partner@example.com",
      TEST_PARTNER_PASSWORD,
    );

    const response = await request(app)
      .patch("/api/v1/users/me/password")
      .set("Authorization", `Bearer ${partnerToken}`)
      .send({
        currentPassword: TEST_PARTNER_PASSWORD,
        newPassword: TEST_CHANGED_PASSWORD,
      });

    assert.equal(response.status, 200);
    assert.equal(response.body.message, "Contraseña actualizada exitosamente.");
    assert.equal(response.body.data.user.id, 2);
    assert.equal("passwordHash" in response.body.data.user, false);
    assert.equal(typeof response.body.data.token, "string");

    const freshToken = response.body.data.token as string;

    const freshSessionResponse = await request(app)
      .get("/api/v1/users/me")
      .set("Authorization", `Bearer ${freshToken}`);

    assert.equal(freshSessionResponse.status, 200);

    for (const invalidatedToken of [partnerToken, otherSessionToken]) {
      const invalidatedResponse = await request(app)
        .get("/api/v1/users/me")
        .set("Authorization", `Bearer ${invalidatedToken}`);

      assert.equal(invalidatedResponse.status, 401);
      assert.equal(invalidatedResponse.body.code, "SESSION_INVALIDATED");
    }

    const reloginResponse = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "partner@example.com", password: TEST_CHANGED_PASSWORD });

    assert.equal(reloginResponse.status, 200);
  });

  it("allows ADMIN to change its own password through /users/me/password", async () => {
    const adminToken = await login("admin@example.com", TEST_ADMIN_PASSWORD);

    const response = await request(app)
      .patch("/api/v1/users/me/password")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        currentPassword: TEST_ADMIN_PASSWORD,
        newPassword: TEST_CHANGED_PASSWORD,
      });

    assert.equal(response.status, 200);
    assert.equal(response.body.data.user.id, 1);
    assert.equal(response.body.data.user.role, Role.ADMIN);
    assert.equal(typeof response.body.data.token, "string");
    assert.equal("passwordHash" in response.body.data.user, false);
  });

  it("returns INVALID_CURRENT_PASSWORD when the current password is wrong", async () => {
    const partnerToken = await login(
      "partner@example.com",
      TEST_PARTNER_PASSWORD,
    );
    const partner = database.users.find((user) => user.id === 2);
    assert.ok(partner);
    const passwordHashBefore = partner.passwordHash;

    const response = await request(app)
      .patch("/api/v1/users/me/password")
      .set("Authorization", `Bearer ${partnerToken}`)
      .send({
        currentPassword: "Wrong-Password1!",
        newPassword: TEST_CHANGED_PASSWORD,
      });

    assert.equal(response.status, 401);
    assert.equal(response.body.code, "INVALID_CURRENT_PASSWORD");
    assert.equal(partner.passwordHash, passwordHashBefore);

    const sessionResponse = await request(app)
      .get("/api/v1/users/me")
      .set("Authorization", `Bearer ${partnerToken}`);

    assert.equal(sessionResponse.status, 200);
  });

  it("rejects invalid new passwords on the own-password endpoint", async () => {
    const partnerToken = await login(
      "partner@example.com",
      TEST_PARTNER_PASSWORD,
    );

    const invalidBodies = [
      { currentPassword: TEST_PARTNER_PASSWORD, newPassword: "corta" },
      { currentPassword: TEST_PARTNER_PASSWORD, newPassword: "ñ".repeat(37) },
      {
        currentPassword: TEST_PARTNER_PASSWORD,
        newPassword: TEST_PARTNER_PASSWORD,
      },
      { newPassword: TEST_CHANGED_PASSWORD },
      {
        currentPassword: TEST_PARTNER_PASSWORD,
        newPassword: TEST_CHANGED_PASSWORD,
        userId: 1,
      },
      { currentPassword: TEST_PARTNER_PASSWORD, newPassword: 12345678 },
    ];

    for (const body of invalidBodies) {
      const response = await request(app)
        .patch("/api/v1/users/me/password")
        .set("Authorization", `Bearer ${partnerToken}`)
        .send(body);

      assert.equal(response.status, 400);
      assert.equal(response.body.code, "VALIDATION_ERROR");
    }

    const partner = database.users.find((user) => user.id === 2);
    assert.ok(partner);
    assert.notEqual(partner.passwordHash, TEST_CHANGED_PASSWORD);
  });

  it("rejects a duplicate email during user update", async () => {
    const adminToken = await login("admin@example.com", TEST_ADMIN_PASSWORD);

    const response = await request(app)
      .patch("/api/v1/users/2")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ email: "admin@example.com" });

    assert.equal(response.status, 409);
    assert.equal(response.body.code, "EMAIL_ALREADY_REGISTERED");

    const sameEmailResponse = await request(app)
      .patch("/api/v1/users/2")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ email: "partner@example.com", phone: "04120000000" });

    assert.equal(sameEmailResponse.status, 200);
    assert.equal(sameEmailResponse.body.data.user.phone, "04120000000");
  });

  it("rejects unknown, protected and empty update bodies", async () => {
    const adminToken = await login("admin@example.com", TEST_ADMIN_PASSWORD);

    const invalidBodies = [
      {},
      { unknownField: "value" },
      { id: 99 },
      { createdAt: "2026-01-01T00:00:00.000Z" },
      { updatedAt: "2026-01-01T00:00:00.000Z" },
    ];

    for (const body of invalidBodies) {
      const response = await request(app)
        .patch("/api/v1/users/2")
        .set("Authorization", `Bearer ${adminToken}`)
        .send(body);

      assert.equal(response.status, 400);
      assert.equal(response.body.code, "VALIDATION_ERROR");
    }
  });

  it("protects the last ADMIN from role demotion", async () => {
    const adminToken = await login("admin@example.com", TEST_ADMIN_PASSWORD);

    const response = await request(app)
      .patch("/api/v1/users/1")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ role: Role.PARTNER });

    assert.equal(response.status, 409);
    assert.equal(response.body.code, "LAST_ADMIN_REQUIRED");

    const detailResponse = await request(app)
      .get("/api/v1/users/1")
      .set("Authorization", `Bearer ${adminToken}`);

    assert.equal(detailResponse.body.data.user.role, Role.ADMIN);
  });

  it("allows demoting an ADMIN when another ADMIN remains", async () => {
    database.addUser({
      id: 3,
      email: "second-admin@example.com",
      role: Role.ADMIN,
      password: TEST_NEW_USER_PASSWORD,
    });
    const adminToken = await login("admin@example.com", TEST_ADMIN_PASSWORD);

    const response = await request(app)
      .patch("/api/v1/users/1")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ role: Role.PARTNER });

    assert.equal(response.status, 200);
    assert.equal(response.body.data.user.id, 1);
    assert.equal(response.body.data.user.role, Role.PARTNER);

    const listResponse = await request(app)
      .get("/api/v1/users")
      .set("Authorization", `Bearer ${adminToken}`);

    assert.equal(listResponse.status, 403);
    assert.equal(listResponse.body.code, "ADMIN_REQUIRED");
  });

  it("keeps one ADMIN when two admins demote themselves concurrently", async () => {
    database.addUser({
      id: 3,
      email: "second-admin@example.com",
      role: Role.ADMIN,
      password: TEST_NEW_USER_PASSWORD,
    });

    const firstAdminToken = await login(
      "admin@example.com",
      TEST_ADMIN_PASSWORD,
    );
    const secondAdminToken = await login(
      "second-admin@example.com",
      TEST_NEW_USER_PASSWORD,
    );

    const [firstResponse, secondResponse] = await Promise.all([
      request(app)
        .patch("/api/v1/users/1")
        .set("Authorization", `Bearer ${firstAdminToken}`)
        .send({ role: Role.PARTNER }),
      request(app)
        .patch("/api/v1/users/3")
        .set("Authorization", `Bearer ${secondAdminToken}`)
        .send({ role: Role.PARTNER }),
    ]);

    const statuses = [firstResponse.status, secondResponse.status].sort();
    assert.deepEqual(statuses, [200, 409]);

    const rejectedResponse =
      firstResponse.status === 409 ? firstResponse : secondResponse;
    assert.equal(rejectedResponse.body.code, "LAST_ADMIN_REQUIRED");

    const remainingAdmins = database.users.filter(
      (user) => user.role === Role.ADMIN,
    );
    assert.equal(remainingAdmins.length, 1);
  });

  it("returns USER_NOT_FOUND when updating a nonexistent user", async () => {
    const adminToken = await login("admin@example.com", TEST_ADMIN_PASSWORD);

    const response = await request(app)
      .patch("/api/v1/users/999")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ firstName: "Inexistente" });

    assert.equal(response.status, 404);
    assert.equal(response.body.code, "USER_NOT_FOUND");
  });

  it("blocks deletion of the last ADMIN", async () => {
    const adminToken = await login("admin@example.com", TEST_ADMIN_PASSWORD);

    const response = await request(app)
      .delete("/api/v1/users/1")
      .set("Authorization", `Bearer ${adminToken}`);

    assert.equal(response.status, 409);
    assert.equal(response.body.code, "LAST_ADMIN_REQUIRED");
    assert.equal(database.users.length, 2);
  });

  it("blocks ADMIN from deleting itself when another ADMIN remains", async () => {
    database.addUser({
      id: 3,
      email: "second-admin@example.com",
      role: Role.ADMIN,
      password: TEST_NEW_USER_PASSWORD,
    });
    const adminToken = await login("admin@example.com", TEST_ADMIN_PASSWORD);

    const response = await request(app)
      .delete("/api/v1/users/1")
      .set("Authorization", `Bearer ${adminToken}`);

    assert.equal(response.status, 409);
    assert.equal(response.body.code, "SELF_DELETION_NOT_ALLOWED");
    assert.equal(database.users.length, 3);
  });

  it("blocks deletion of a user with properties", async () => {
    database.addUser({
      id: 3,
      email: "agent@example.com",
      role: Role.PARTNER,
      password: TEST_NEW_USER_PASSWORD,
    });
    database.setAgentPropertyCount(3, 2);
    const adminToken = await login("admin@example.com", TEST_ADMIN_PASSWORD);

    const response = await request(app)
      .delete("/api/v1/users/3")
      .set("Authorization", `Bearer ${adminToken}`);

    assert.equal(response.status, 409);
    assert.equal(response.body.code, "USER_HAS_PROPERTIES");
    assert.equal(
      database.users.some((user) => user.id === 3),
      true,
    );
  });

  it("allows ADMIN to delete a user without relations", async () => {
    database.addUser({
      id: 3,
      email: "partner-to-delete@example.com",
      role: Role.PARTNER,
      password: TEST_NEW_USER_PASSWORD,
    });
    const adminToken = await login("admin@example.com", TEST_ADMIN_PASSWORD);

    const response = await request(app)
      .delete("/api/v1/users/3")
      .set("Authorization", `Bearer ${adminToken}`);

    assert.equal(response.status, 200);
    assert.equal(response.body.message, "Usuario eliminado exitosamente.");
    assert.deepEqual(response.body.data, { deletedId: 3 });

    const detailResponse = await request(app)
      .get("/api/v1/users/3")
      .set("Authorization", `Bearer ${adminToken}`);

    assert.equal(detailResponse.status, 404);

    const listResponse = await request(app)
      .get("/api/v1/users")
      .set("Authorization", `Bearer ${adminToken}`);

    assert.equal(listResponse.body.data.users.length, 2);
  });

  it("cleans revoked and password reset tokens of the deleted user", async () => {
    database.addUser({
      id: 3,
      email: "partner-to-delete@example.com",
      role: Role.PARTNER,
      password: TEST_NEW_USER_PASSWORD,
    });
    database.revokedTokens.push(
      createRevokedTokenFixture(
        1,
        "revoked-hash-user-3",
        new Date("2026-12-31T00:00:00.000Z"),
        3,
      ),
      createRevokedTokenFixture(
        2,
        "revoked-hash-user-2",
        new Date("2026-12-31T00:00:00.000Z"),
        2,
      ),
    );
    database.passwordResetTokens.push(
      createPasswordResetTokenFixture(
        1,
        "reset-hash-user-3",
        3,
        new Date("2026-12-31T00:00:00.000Z"),
      ),
      createPasswordResetTokenFixture(
        2,
        "reset-hash-user-2",
        2,
        new Date("2026-12-31T00:00:00.000Z"),
      ),
    );
    const adminToken = await login("admin@example.com", TEST_ADMIN_PASSWORD);

    const response = await request(app)
      .delete("/api/v1/users/3")
      .set("Authorization", `Bearer ${adminToken}`);

    assert.equal(response.status, 200);
    assert.deepEqual(
      database.revokedTokens.map((token) => token.userId),
      [2],
    );
    assert.deepEqual(
      database.passwordResetTokens.map((token) => token.userId),
      [2],
    );
    assert.equal(
      database.users.some((user) => user.id === 3),
      false,
    );
  });

  it("blocks PARTNER from deleting users", async () => {
    const partnerToken = await login(
      "partner@example.com",
      TEST_PARTNER_PASSWORD,
    );

    const response = await request(app)
      .delete("/api/v1/users/1")
      .set("Authorization", `Bearer ${partnerToken}`);

    assert.equal(response.status, 403);
    assert.equal(response.body.code, "ADMIN_REQUIRED");
    assert.equal(database.users.length, 2);
  });

  it("returns USER_NOT_FOUND when deleting a nonexistent user", async () => {
    const adminToken = await login("admin@example.com", TEST_ADMIN_PASSWORD);

    const response = await request(app)
      .delete("/api/v1/users/999")
      .set("Authorization", `Bearer ${adminToken}`);

    assert.equal(response.status, 404);
    assert.equal(response.body.code, "USER_NOT_FOUND");
  });

  it("never exposes password hashes in user management responses", async () => {
    const adminToken = await login("admin@example.com", TEST_ADMIN_PASSWORD);

    const updateResponse = await request(app)
      .patch("/api/v1/users/2")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ photoUrl: null });
    const listResponse = await request(app)
      .get("/api/v1/users")
      .set("Authorization", `Bearer ${adminToken}`);
    const detailResponse = await request(app)
      .get("/api/v1/users/2")
      .set("Authorization", `Bearer ${adminToken}`);
    const changePasswordResponse = await request(app)
      .patch("/api/v1/users/me/password")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        currentPassword: TEST_ADMIN_PASSWORD,
        newPassword: TEST_CHANGED_PASSWORD,
      });

    for (const response of [
      updateResponse,
      listResponse,
      detailResponse,
      changePasswordResponse,
    ]) {
      assert.equal(response.status, 200);
      assert.equal(JSON.stringify(response.body).includes("passwordHash"), false);
    }

    assert.equal(updateResponse.body.data.user.photoUrl, null);
  });

  it("rejects invalid, expired and revoked tokens on user management endpoints", async () => {
    const missingTokenResponse = await request(app)
      .patch("/api/v1/users/2")
      .send({ firstName: "Nuevo" });

    assert.equal(missingTokenResponse.status, 401);
    assert.equal(missingTokenResponse.body.code, "AUTHENTICATION_REQUIRED");

    for (const invalidToken of ["not-a-jwt", createExpiredToken()]) {
      const response = await request(app)
        .patch("/api/v1/users/2")
        .set("Authorization", `Bearer ${invalidToken}`)
        .send({ firstName: "Nuevo" });

      assert.equal(response.status, 401);
      assert.equal(response.body.code, "INVALID_SESSION");
    }

    const adminToken = await login("admin@example.com", TEST_ADMIN_PASSWORD);

    const logoutResponse = await request(app)
      .post("/api/v1/auth/logout")
      .set("Authorization", `Bearer ${adminToken}`);

    assert.equal(logoutResponse.status, 200);

    const revokedResponse = await request(app)
      .patch("/api/v1/users/2")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ firstName: "Nuevo" });

    assert.equal(revokedResponse.status, 401);
    assert.equal(revokedResponse.body.code, "SESSION_REVOKED");
  });
});
