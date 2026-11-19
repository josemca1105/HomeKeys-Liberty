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
import { flushEmailOutbox } from "./helpers/email-outbox";

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
  ): Record<string, unknown> => {
    return {
      firstName: "Test",
      lastName: "User",
      email,
      phone: "00000000",
      photoUrl: null,
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

    await flushEmailOutbox();

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

    await flushEmailOutbox();

    assert.equal(outbox.length, 2);

    const firstToken = /#token=([0-9a-f]{64})/.exec(outbox[0]?.text ?? "");
    const secondToken = /#token=([0-9a-f]{64})/.exec(outbox[1]?.text ?? "");
    assert.ok(firstToken);
    assert.ok(secondToken);
    assert.notEqual(firstToken[1], secondToken[1]);
  });

  it("sends a password reset link from the ADMIN endpoint", async () => {
    const adminToken = await login("admin@example.com", TEST_ADMIN_PASSWORD);

    const response = await request(app)
      .post("/api/v1/users/2/send-password-reset")
      .set("Authorization", `Bearer ${adminToken}`);

    assert.equal(response.status, 200);
    assert.equal(response.body.data.emailSent, true);

    await flushEmailOutbox();

    assert.equal(outbox.length, 1);

    const mail = outbox[0];
    assert.ok(mail);
    assert.equal(mail.to, "partner@example.com");
    assert.equal(/#token=[0-9a-f]{64}/.test(mail.text), true);

    const audit = database.auditLogs.find(
      (log) => log.action === "PASSWORD_RESET_LINK_SENT",
    );
    assert.ok(audit);
    assert.equal(audit.actorId, 1);
    assert.equal(audit.entityId, 2);
  });

  it("blocks reset-link requests for inactive accounts and non-admins", async () => {
    const adminToken = await login("admin@example.com", TEST_ADMIN_PASSWORD);
    const partner = database.users.find((user) => user.id === 2);
    assert.ok(partner);
    partner.isActive = false;

    const inactiveResponse = await request(app)
      .post("/api/v1/users/2/send-password-reset")
      .set("Authorization", `Bearer ${adminToken}`);

    assert.equal(inactiveResponse.status, 409);
    assert.equal(inactiveResponse.body.code, "USER_INACTIVE");

    partner.isActive = true;
    const partnerToken = await login(
      "partner@example.com",
      TEST_PARTNER_PASSWORD,
    );

    const forbiddenResponse = await request(app)
      .post("/api/v1/users/1/send-password-reset")
      .set("Authorization", `Bearer ${partnerToken}`);

    assert.equal(forbiddenResponse.status, 403);
    assert.equal(forbiddenResponse.body.code, "ADMIN_REQUIRED");

    const notFoundResponse = await request(app)
      .post("/api/v1/users/999/send-password-reset")
      .set("Authorization", `Bearer ${adminToken}`);

    assert.equal(notFoundResponse.status, 404);
    assert.equal(notFoundResponse.body.code, "USER_NOT_FOUND");
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

  it("rejects an identity-based password in the recovery flow", async () => {
    const forgotResponse = await request(app)
      .post("/api/v1/auth/forgot-password")
      .send({ email: "partner@example.com" });

    assert.equal(forgotResponse.status, 200);
    await flushBackgroundTasks();
    await flushEmailOutbox();

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
