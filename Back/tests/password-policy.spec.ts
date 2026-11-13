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
  TEST_CHANGED_PASSWORD,
  TEST_PARTNER_PASSWORD,
} from "./helpers/mock-database";
import type { MockDatabase } from "./helpers/mock-database";
import { flushBackgroundTasks } from "./helpers/background-tasks";

const INVALID_PASSWORD_CASES = [
  {
    password: "abcdefghij1!",
    message: "La contraseña debe incluir al menos una letra mayúscula.",
  },
  {
    password: "ABCDEFGHIJ1!",
    message: "La contraseña debe incluir al menos una letra minúscula.",
  },
  {
    password: "ABCDEFGHIJa!",
    message: "La contraseña debe incluir al menos un número.",
  },
  {
    password: "ABCDEFGHIJ1a",
    message: "La contraseña debe incluir al menos un carácter especial.",
  },
  {
    password: "Ab1!",
    message: "La contraseña debe tener al menos 12 caracteres.",
  },
  {
    password: "ñ".repeat(37),
    message: "La contraseña no puede superar los 72 bytes en formato UTF-8.",
  },
  {
    password: "Password1234!",
    message:
      "La contraseña es demasiado común o predecible. Elige una diferente.",
  },
];

describe("Password policy HTTP integration", { concurrency: false }, () => {
  let app: Express;
  let database: MockDatabase;
  let outbox: OutgoingMail[];

  beforeEach(() => {
    database = createMockDatabase();
    app = createApp();
    outbox = [];

    setMailSenderForTesting({
      sendMail: async (options: OutgoingMail): Promise<unknown> => {
        outbox.push(options);
        return { accepted: [options.to] };
      },
    });
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

  it("creates a user without password and sends an activation invitation", async () => {
    const adminToken = await login("admin@example.com", TEST_ADMIN_PASSWORD);

    const response = await request(app)
      .post("/api/v1/users/add")
      .set("Authorization", `Bearer ${adminToken}`)
      .send(createUserPayload("invited@example.com"));

    assert.equal(response.status, 201);
    assert.equal("passwordHash" in response.body.data.user, false);
    assert.equal("temporaryPassword" in response.body.data, false);
    assert.equal(response.body.data.invitationSent, true);
    assert.equal(response.body.data.user.mustChangePassword, true);

    // The invitation email carries a one-time activation link and never the
    // initial password.
    assert.equal(outbox.length, 1);
    const mail = outbox[0];
    assert.ok(mail);
    assert.equal(mail.to, "invited@example.com");
    assert.equal(
      mail.subject,
      "Bienvenido a HomeKeys Liberty - Activa tu cuenta",
    );
    assert.equal(mail.html.includes("Activar mi cuenta"), true);
    assert.equal(mail.text.includes("24 horas"), true);
    assert.equal(/token=([0-9a-f]{64})/.test(mail.text), true);
    assert.equal(mail.html.includes("passwordHash"), false);

    const createdUser = database.users.find(
      (user) => user.email === "invited@example.com",
    );
    assert.ok(createdUser);
    assert.equal(createdUser.passwordHash.startsWith("$2"), true);
    assert.equal(createdUser.mustChangePassword, true);

    // The user defines a personal password through the activation link.
    const tokenMatch = /token=([0-9a-f]{64})/.exec(mail.text);
    assert.ok(tokenMatch);
    const activationToken = tokenMatch[1] as string;

    const activationResponse = await request(app)
      .post("/api/v1/auth/reset-password")
      .send({ token: activationToken, newPassword: TEST_CHANGED_PASSWORD });

    assert.equal(activationResponse.status, 200);

    const sessionToken = await login(
      "invited@example.com",
      TEST_CHANGED_PASSWORD,
    );
    const profileResponse = await request(app)
      .get("/api/v1/users/me")
      .set("Authorization", `Bearer ${sessionToken}`);

    assert.equal(profileResponse.status, 200);
    assert.equal(profileResponse.body.data.user.mustChangePassword, false);
  });

  it("issues a different activation token for every creation", async () => {
    const adminToken = await login("admin@example.com", TEST_ADMIN_PASSWORD);

    const firstResponse = await request(app)
      .post("/api/v1/users/add")
      .set("Authorization", `Bearer ${adminToken}`)
      .send(createUserPayload("first-invited@example.com"));
    const secondResponse = await request(app)
      .post("/api/v1/users/add")
      .set("Authorization", `Bearer ${adminToken}`)
      .send(createUserPayload("second-invited@example.com"));

    assert.equal(firstResponse.status, 201);
    assert.equal(secondResponse.status, 201);
    assert.equal(outbox.length, 2);

    const firstToken = /#token=([0-9a-f]{64})/.exec(outbox[0]?.text ?? "");
    const secondToken = /#token=([0-9a-f]{64})/.exec(outbox[1]?.text ?? "");
    assert.ok(firstToken);
    assert.ok(secondToken);
    assert.notEqual(firstToken[1], secondToken[1]);
  });

  it("keeps the explicit password flow and forces a password change", async () => {
    const adminToken = await login("admin@example.com", TEST_ADMIN_PASSWORD);

    const response = await request(app)
      .post("/api/v1/users/add")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        ...createUserPayload("explicit@example.com", TEST_PARTNER_PASSWORD),
        role: Role.ADMIN,
      });

    assert.equal(response.status, 201);
    assert.equal("temporaryPassword" in response.body.data, false);
    assert.equal("passwordHash" in response.body.data.user, false);
    assert.equal(response.body.data.invitationSent, true);

    // The explicit password is known only by the ADMIN: it never travels by
    // email, while the invitation still includes the activation link.
    assert.equal(outbox.length, 1);
    const mail = outbox[0];
    assert.ok(mail);
    assert.equal(mail.html.includes(TEST_PARTNER_PASSWORD), false);
    assert.equal(mail.text.includes(TEST_PARTNER_PASSWORD), false);
    assert.equal(mail.html.includes("Activar mi cuenta"), true);

    // Logging in with the ADMIN-defined password works, but the user is
    // forced to define a personal one before using the rest of the API.
    const sessionToken = await login(
      "explicit@example.com",
      TEST_PARTNER_PASSWORD,
    );

    const loginResponse = await request(app)
      .post("/api/v1/auth/login")
      .send({
        email: "explicit@example.com",
        password: TEST_PARTNER_PASSWORD,
      });
    assert.equal(loginResponse.body.data.user.mustChangePassword, true);

    const blockedResponse = await request(app)
      .get("/api/v1/users")
      .set("Authorization", `Bearer ${sessionToken}`);
    assert.equal(blockedResponse.status, 403);
    assert.equal(blockedResponse.body.code, "PASSWORD_CHANGE_REQUIRED");

    const changeResponse = await request(app)
      .patch("/api/v1/users/me/password")
      .set("Authorization", `Bearer ${sessionToken}`)
      .send({
        currentPassword: TEST_PARTNER_PASSWORD,
        newPassword: TEST_CHANGED_PASSWORD,
      });

    assert.equal(changeResponse.status, 200);
    assert.equal(
      changeResponse.body.data.user.mustChangePassword,
      false,
    );

    const freshToken = changeResponse.body.data.token as string;
    const restoredResponse = await request(app)
      .get("/api/v1/users")
      .set("Authorization", `Bearer ${freshToken}`);
    assert.equal(restoredResponse.status, 200);
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

    const accentPassword = "Ñandú#2026xy";
    const accentResponse = await request(app)
      .patch("/api/v1/users/me/password")
      .set("Authorization", `Bearer ${partnerToken}`)
      .send({
        currentPassword: TEST_PARTNER_PASSWORD,
        newPassword: accentPassword,
      });

    assert.equal(accentResponse.status, 200);

    const accentToken = await login("partner@example.com", accentPassword);
    assert.equal(typeof accentToken, "string");

    const longPassword = `Abcdef1!${"x".repeat(20)}`;
    const longResponse = await request(app)
      .patch("/api/v1/users/me/password")
      .set("Authorization", `Bearer ${accentToken}`)
      .send({
        currentPassword: accentPassword,
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

  it("rejects passwords based on the email or the name on user creation", async () => {
    const adminToken = await login("admin@example.com", TEST_ADMIN_PASSWORD);

    const response = await request(app)
      .post("/api/v1/users/add")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        firstName: "Maria",
        lastName: "Gonzalez",
        email: "maria.gonzalez@example.com",
        phone: "00000000",
        photoUrl: null,
        password: "MariaGonzalez2026!",
      });

    assertPasswordValidationError(
      response,
      "password",
      "La contraseña no puede basarse en tu correo o en tu nombre.",
    );
  });

  it("rejects an identity-based password in the own-password flow", async () => {
    const partnerToken = await login(
      "partner@example.com",
      TEST_PARTNER_PASSWORD,
    );

    const response = await request(app)
      .patch("/api/v1/users/me/password")
      .set("Authorization", `Bearer ${partnerToken}`)
      .send({
        currentPassword: TEST_PARTNER_PASSWORD,
        newPassword: "Partner20262026!",
      });

    assertPasswordValidationError(
      response,
      "newPassword",
      "La contraseña no puede basarse en tu correo o en tu nombre.",
    );
  });

  it("rejects an identity-based password in the admin reset flow", async () => {
    const adminToken = await login("admin@example.com", TEST_ADMIN_PASSWORD);

    const response = await request(app)
      .patch("/api/v1/users/2")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ password: "Partner20262026!" });

    assertPasswordValidationError(
      response,
      "password",
      "La contraseña no puede basarse en tu correo o en tu nombre.",
    );
  });

  it("rejects an identity-based password in the recovery flow", async () => {
    const forgotResponse = await request(app)
      .post("/api/v1/auth/forgot-password")
      .send({ email: "partner@example.com" });

    assert.equal(forgotResponse.status, 200);
    await flushBackgroundTasks();

    const mail = outbox[outbox.length - 1];
    assert.ok(mail);
    const tokenMatch = /#token=([0-9a-f]{64})/.exec(mail.text);
    assert.ok(tokenMatch);

    const response = await request(app)
      .post("/api/v1/auth/reset-password")
      .send({
        token: tokenMatch[1] as string,
        newPassword: "Partner20262026!",
      });

    assertPasswordValidationError(
      response,
      "newPassword",
      "La contraseña no puede basarse en tu correo o en tu nombre.",
    );
  });
});
