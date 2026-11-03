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

const INVALID_PASSWORD_CASES = [
  {
    password: "abcdefgh1!",
    message: "La contraseña debe incluir al menos una letra mayúscula.",
  },
  {
    password: "ABCDEFGH1!",
    message: "La contraseña debe incluir al menos una letra minúscula.",
  },
  {
    password: "ABCDEFGHa!",
    message: "La contraseña debe incluir al menos un número.",
  },
  {
    password: "ABCDEFGH1a",
    message: "La contraseña debe incluir al menos un carácter especial.",
  },
  {
    password: "Ab1!",
    message: "La contraseña debe tener al menos 8 caracteres.",
  },
  {
    password: "ñ".repeat(37),
    message: "La contraseña no puede superar los 72 bytes en formato UTF-8.",
  },
];

describe("Password policy HTTP integration", { concurrency: false }, () => {
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

  const createUserPayload = (
    email: string,
    password?: string,
  ): Record<string, unknown> => {
    return {
      firstName: "Test",
      lastName: "User",
      email,
      phone: "00000000",
      photoUrl: null,
      ...(password !== undefined ? { password } : {}),
    };
  };

  const assertPasswordValidationError = (
    response: request.Response,
    field: string,
    message: string,
  ): void => {
    assert.equal(response.status, 400);
    assert.equal(response.body.code, "VALIDATION_ERROR");
    assert.equal(
      response.body.errors.some(
        (error: { field: string; message: string }) =>
          error.field === field && error.message === message,
      ),
      true,
    );
  };

  it("generates a temporary password when ADMIN creates a user without one", async () => {
    const adminToken = await login("admin@example.com", TEST_ADMIN_PASSWORD);

    const response = await request(app)
      .post("/api/v1/users/add")
      .set("Authorization", `Bearer ${adminToken}`)
      .send(createUserPayload("generated@example.com"));

    assert.equal(response.status, 201);
    assert.equal("passwordHash" in response.body.data.user, false);

    const temporaryPassword = response.body.data.temporaryPassword as string;
    assert.equal(typeof temporaryPassword, "string");
    assert.equal(temporaryPassword.length, 16);
    assert.equal(/\p{Lu}/u.test(temporaryPassword), true);
    assert.equal(/\p{Ll}/u.test(temporaryPassword), true);
    assert.equal(/\p{N}/u.test(temporaryPassword), true);
    assert.equal(/[\p{P}\p{S}]/u.test(temporaryPassword), true);
    assert.equal(/[0Ol1]/.test(temporaryPassword), false);

    const createdUser = database.users.find(
      (user) => user.email === "generated@example.com",
    );
    assert.ok(createdUser);
    assert.equal(createdUser.passwordHash.startsWith("$2"), true);
    assert.notEqual(createdUser.passwordHash, temporaryPassword);

    const generatedToken = await login(
      "generated@example.com",
      temporaryPassword,
    );
    assert.equal(typeof generatedToken, "string");
  });

  it("generates a different temporary password on every creation", async () => {
    const adminToken = await login("admin@example.com", TEST_ADMIN_PASSWORD);

    const firstResponse = await request(app)
      .post("/api/v1/users/add")
      .set("Authorization", `Bearer ${adminToken}`)
      .send(createUserPayload("first-generated@example.com"));
    const secondResponse = await request(app)
      .post("/api/v1/users/add")
      .set("Authorization", `Bearer ${adminToken}`)
      .send(createUserPayload("second-generated@example.com"));

    assert.equal(firstResponse.status, 201);
    assert.equal(secondResponse.status, 201);
    assert.notEqual(
      firstResponse.body.data.temporaryPassword,
      secondResponse.body.data.temporaryPassword,
    );
  });

  it("keeps the explicit password flow without returning a temporary password", async () => {
    const adminToken = await login("admin@example.com", TEST_ADMIN_PASSWORD);

    const response = await request(app)
      .post("/api/v1/users/add")
      .set("Authorization", `Bearer ${adminToken}`)
      .send(
        createUserPayload("explicit@example.com", TEST_PARTNER_PASSWORD),
      );

    assert.equal(response.status, 201);
    assert.equal("temporaryPassword" in response.body.data, false);
    assert.equal("passwordHash" in response.body.data.user, false);

    const explicitToken = await login(
      "explicit@example.com",
      TEST_PARTNER_PASSWORD,
    );
    assert.equal(typeof explicitToken, "string");
  });

  it("enforces the password policy on user creation", async () => {
    const adminToken = await login("admin@example.com", TEST_ADMIN_PASSWORD);

    for (const invalidCase of INVALID_PASSWORD_CASES) {
      const response = await request(app)
        .post("/api/v1/users/add")
        .set("Authorization", `Bearer ${adminToken}`)
        .send(
          createUserPayload("invalid@example.com", invalidCase.password),
        );

      assertPasswordValidationError(response, "password", invalidCase.message);
    }
  });

  it("enforces the password policy on the own-password endpoint", async () => {
    const partnerToken = await login(
      "partner@example.com",
      TEST_PARTNER_PASSWORD,
    );

    for (const invalidCase of INVALID_PASSWORD_CASES) {
      const response = await request(app)
        .patch("/api/v1/users/me/password")
        .set("Authorization", `Bearer ${partnerToken}`)
        .send({
          currentPassword: TEST_PARTNER_PASSWORD,
          newPassword: invalidCase.password,
        });

      assertPasswordValidationError(
        response,
        "newPassword",
        invalidCase.message,
      );
    }

    const sessionResponse = await request(app)
      .get("/api/v1/users/me")
      .set("Authorization", `Bearer ${partnerToken}`);
    assert.equal(sessionResponse.status, 200);
  });

  it("enforces the password policy on admin password resets", async () => {
    const adminToken = await login("admin@example.com", TEST_ADMIN_PASSWORD);

    for (const invalidCase of INVALID_PASSWORD_CASES) {
      const response = await request(app)
        .patch("/api/v1/users/2")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ password: invalidCase.password });

      assertPasswordValidationError(response, "password", invalidCase.message);
    }
  });

  it("accepts policy-compliant passwords with accents and without an artificial length cap", async () => {
    const partnerToken = await login(
      "partner@example.com",
      TEST_PARTNER_PASSWORD,
    );

    const accentResponse = await request(app)
      .patch("/api/v1/users/me/password")
      .set("Authorization", `Bearer ${partnerToken}`)
      .send({
        currentPassword: TEST_PARTNER_PASSWORD,
        newPassword: "Ñandú#2026x",
      });

    assert.equal(accentResponse.status, 200);

    const accentToken = await login("partner@example.com", "Ñandú#2026x");
    assert.equal(typeof accentToken, "string");

    const longPassword = `Abcdef1!${"x".repeat(20)}`;
    const longResponse = await request(app)
      .patch("/api/v1/users/me/password")
      .set("Authorization", `Bearer ${accentToken}`)
      .send({
        currentPassword: "Ñandú#2026x",
        newPassword: longPassword,
      });

    assert.equal(longResponse.status, 200);

    const longToken = await login("partner@example.com", longPassword);
    assert.equal(typeof longToken, "string");
  });

  it("does not apply the policy retroactively to existing passwords", async () => {
    database.addUser({
      id: 3,
      email: "legacy@example.com",
      role: Role.PARTNER,
      password: "legacyweak",
    });

    const legacyToken = await login("legacy@example.com", "legacyweak");
    assert.equal(typeof legacyToken, "string");

    const sessionResponse = await request(app)
      .get("/api/v1/users/me")
      .set("Authorization", `Bearer ${legacyToken}`);

    assert.equal(sessionResponse.status, 200);
    assert.equal(sessionResponse.body.data.user.id, 3);
  });
});
