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

describe("Invitation and forced password change HTTP integration", { concurrency: false }, () => {
  let app: Express;
  let database: MockDatabase;
  let outbox: OutgoingMail[];
  let shouldFailMailDelivery: boolean;

  beforeEach(() => {
    database = createMockDatabase();
    app = createApp();
    outbox = [];
    shouldFailMailDelivery = false;

    setMailSenderForTesting({
      sendMail: async (options: OutgoingMail): Promise<unknown> => {
        if (shouldFailMailDelivery) {
          throw new Error("SMTP unavailable");
        }

        outbox.push(options);
        return { accepted: [options.to] };
      },
    });
  });

  afterEach(() => {
    setMailSenderForTesting(null);
  });

  const extractTokenFromMail = (mail: OutgoingMail): string => {
    const match = /token=([0-9a-f]+)/.exec(mail.text);
    assert.ok(match);
    return match[1] as string;
  };

  const createInvitedUser = async (
    adminToken: string,
    email: string,
  ): Promise<{ userId: number; invitationToken: string }> => {
    const response = await request(app)
      .post("/api/v1/users/add")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        firstName: "Test",
        lastName: "Invited",
        email,
        phone: "00000000",
        photoUrl: null,
      });

    assert.equal(response.status, 201);

    const invitationMail = outbox[outbox.length - 1];
    assert.ok(invitationMail);

    return {
      userId: response.body.data.user.id as number,
      invitationToken: extractTokenFromMail(invitationMail),
    };
  };

  const login = async (
    email: string,
    password: string,
  ): Promise<{ token: string; mustChangePassword: boolean }> => {
    const response = await request(app)
      .post("/api/v1/auth/login")
      .send({ email, password });

    assert.equal(response.status, 200);
    return {
      token: response.body.data.token as string,
      mustChangePassword: response.body.data.user.mustChangePassword as boolean,
    };
  };

  it("issues invitation tokens valid for 24 hours", async () => {
    const adminToken = (
      await login("admin@example.com", TEST_ADMIN_PASSWORD)
    ).token;

    const response = await request(app)
      .post("/api/v1/users/add")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        firstName: "Test",
        lastName: "Invited",
        email: "invited@example.com",
        phone: "00000000",
        photoUrl: null,
      });

    assert.equal(response.status, 201);

    const storedToken = database.passwordResetTokens[0];
    assert.ok(storedToken);
    const ttlMs = storedToken.expiresAt.getTime() - Date.now();
    assert.equal(ttlMs > 23.9 * 60 * 60 * 1000, true);
    assert.equal(ttlMs <= 24 * 60 * 60 * 1000, true);
  });

  it("reports email failures without breaking user creation", async () => {
    shouldFailMailDelivery = true;
    const adminToken = (
      await login("admin@example.com", TEST_ADMIN_PASSWORD)
    ).token;

    const response = await request(app)
      .post("/api/v1/users/add")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        firstName: "Test",
        lastName: "NoMail",
        email: "no-mail@example.com",
        phone: "00000000",
        photoUrl: null,
      });

    assert.equal(response.status, 201);
    assert.equal(response.body.data.invitationSent, false);
    assert.equal(response.body.data.user.mustChangePassword, true);
    assert.equal(outbox.length, 0);
    assert.equal(
      database.users.some((user) => user.email === "no-mail@example.com"),
      true,
    );
  });

  it("blocks management routes until an invited ADMIN defines its password", async () => {
    const adminToken = (
      await login("admin@example.com", TEST_ADMIN_PASSWORD)
    ).token;

    const createResponse = await request(app)
      .post("/api/v1/users/add")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        firstName: "Test",
        lastName: "InvitedAdmin",
        email: "invited-admin@example.com",
        password: TEST_PARTNER_PASSWORD,
        phone: "00000000",
        photoUrl: null,
        role: Role.ADMIN,
      });

    assert.equal(createResponse.status, 201);

    const session = await login(
      "invited-admin@example.com",
      TEST_PARTNER_PASSWORD,
    );
    assert.equal(session.mustChangePassword, true);

    const blockedRequests = [
      request(app).get("/api/v1/users"),
      request(app).post("/api/v1/users/add").send({}),
      request(app).patch("/api/v1/users/2").send({ firstName: "Blocked" }),
      request(app).delete("/api/v1/users/2"),
      request(app).get("/api/v1/users/2"),
    ];

    for (const blockedRequest of blockedRequests) {
      const response = await blockedRequest.set(
        "Authorization",
        `Bearer ${session.token}`,
      );

      assert.equal(response.status, 403);
      assert.equal(response.body.code, "PASSWORD_CHANGE_REQUIRED");
    }

    // Profile reads, self password change, and logout stay available so the
    // frontend can render the mandatory change screen.
    const profileResponse = await request(app)
      .get("/api/v1/users/me")
      .set("Authorization", `Bearer ${session.token}`);
    assert.equal(profileResponse.status, 200);

    const changeResponse = await request(app)
      .patch("/api/v1/users/me/password")
      .set("Authorization", `Bearer ${session.token}`)
      .send({
        currentPassword: TEST_PARTNER_PASSWORD,
        newPassword: TEST_CHANGED_PASSWORD,
      });
    assert.equal(changeResponse.status, 200);
    assert.equal(changeResponse.body.data.user.mustChangePassword, false);

    const freshToken = changeResponse.body.data.token as string;
    const restoredResponse = await request(app)
      .get("/api/v1/users")
      .set("Authorization", `Bearer ${freshToken}`);
    assert.equal(restoredResponse.status, 200);

    const logoutResponse = await request(app)
      .post("/api/v1/auth/logout")
      .set("Authorization", `Bearer ${freshToken}`);
    assert.equal(logoutResponse.status, 200);
  });

  it("forces a password change again after an ADMIN password reset and sends a notice", async () => {
    const adminToken = (
      await login("admin@example.com", TEST_ADMIN_PASSWORD)
    ).token;

    const resetResponse = await request(app)
      .patch("/api/v1/users/2")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ password: TEST_CHANGED_PASSWORD });

    assert.equal(resetResponse.status, 200);
    assert.equal(resetResponse.body.data.user.mustChangePassword, true);

    // The notice email never includes the new password.
    assert.equal(outbox.length, 1);
    const notice = outbox[0];
    assert.ok(notice);
    assert.equal(notice.to, "partner@example.com");
    assert.equal(
      notice.subject,
      "Tu contraseña fue restablecida - HomeKeys Liberty",
    );
    assert.equal(notice.html.includes("Iniciar sesión"), true);
    assert.equal(notice.html.includes(TEST_CHANGED_PASSWORD), false);
    assert.equal(notice.text.includes(TEST_CHANGED_PASSWORD), false);

    const session = await login(
      "partner@example.com",
      TEST_CHANGED_PASSWORD,
    );
    assert.equal(session.mustChangePassword, true);

    const changeResponse = await request(app)
      .patch("/api/v1/users/me/password")
      .set("Authorization", `Bearer ${session.token}`)
      .send({
        currentPassword: TEST_CHANGED_PASSWORD,
        newPassword: TEST_ADMIN_PASSWORD,
      });

    assert.equal(changeResponse.status, 200);
    assert.equal(changeResponse.body.data.user.mustChangePassword, false);
  });

  it("invalidates a pending invitation when an ADMIN changes the password", async () => {
    const adminToken = (
      await login("admin@example.com", TEST_ADMIN_PASSWORD)
    ).token;
    const { userId, invitationToken } = await createInvitedUser(
      adminToken,
      "invitation-password@example.com",
    );

    const updateResponse = await request(app)
      .patch(`/api/v1/users/${userId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ password: TEST_CHANGED_PASSWORD });

    assert.equal(updateResponse.status, 200);
    assert.equal(database.passwordResetTokens.length, 0);

    const resetResponse = await request(app)
      .post("/api/v1/auth/reset-password")
      .send({ token: invitationToken, newPassword: TEST_ADMIN_PASSWORD });

    assert.equal(resetResponse.status, 400);
    assert.equal(resetResponse.body.code, "INVALID_RESET_TOKEN");
  });

  it("invalidates a pending invitation when an ADMIN changes the email", async () => {
    const adminToken = (
      await login("admin@example.com", TEST_ADMIN_PASSWORD)
    ).token;
    const { userId, invitationToken } = await createInvitedUser(
      adminToken,
      "invitation-email@example.com",
    );

    const updateResponse = await request(app)
      .patch(`/api/v1/users/${userId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ email: "invitation-email-corrected@example.com" });

    assert.equal(updateResponse.status, 200);
    assert.equal(database.passwordResetTokens.length, 0);

    const resetResponse = await request(app)
      .post("/api/v1/auth/reset-password")
      .send({ token: invitationToken, newPassword: TEST_ADMIN_PASSWORD });

    assert.equal(resetResponse.status, 400);
    assert.equal(resetResponse.body.code, "INVALID_RESET_TOKEN");
  });

  it("invalidates a pending recovery token when the user changes its own password", async () => {
    const partnerToken = (
      await login("partner@example.com", TEST_PARTNER_PASSWORD)
    ).token;

    const forgotResponse = await request(app)
      .post("/api/v1/auth/forgot-password")
      .send({ email: "partner@example.com" });

    assert.equal(forgotResponse.status, 200);
    await flushBackgroundTasks();

    const resetMail = outbox[outbox.length - 1];
    assert.ok(resetMail);
    const recoveryToken = extractTokenFromMail(resetMail);

    const changeResponse = await request(app)
      .patch("/api/v1/users/me/password")
      .set("Authorization", `Bearer ${partnerToken}`)
      .send({
        currentPassword: TEST_PARTNER_PASSWORD,
        newPassword: TEST_CHANGED_PASSWORD,
      });

    assert.equal(changeResponse.status, 200);
    assert.equal(database.passwordResetTokens.length, 0);

    const resetResponse = await request(app)
      .post("/api/v1/auth/reset-password")
      .send({ token: recoveryToken, newPassword: TEST_ADMIN_PASSWORD });

    assert.equal(resetResponse.status, 400);
    assert.equal(resetResponse.body.code, "INVALID_RESET_TOKEN");
  });
});
