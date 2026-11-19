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
    // The activation token must travel in the URL fragment so it never
    // reaches server logs, proxies or Referer headers.
    const match = /#token=([0-9a-f]+)/.exec(mail.text);
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

    await flushEmailOutbox();

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

    await flushEmailOutbox();

    const storedToken = database.passwordResetTokens[0];
    assert.ok(storedToken);
    const ttlMs = storedToken.expiresAt.getTime() - Date.now();
    assert.equal(ttlMs > 23.9 * 60 * 60 * 1000, true);
    assert.equal(ttlMs <= 24 * 60 * 60 * 1000, true);

    // The activation link must carry the token in the URL fragment, never in
    // the query string: fragments do not reach server logs or Referer headers.
    const invitationMail = outbox[outbox.length - 1];
    assert.ok(invitationMail);
    const invitationToken = extractTokenFromMail(invitationMail);
    assert.equal(invitationMail.text.includes(`#token=${invitationToken}`), true);
    assert.equal(invitationMail.html.includes(`#token=${invitationToken}`), true);
    assert.equal(invitationMail.text.includes("?token="), false);
    assert.equal(invitationMail.html.includes("?token="), false);
  });

  it("queues the invitation when SMTP is unavailable", async () => {
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
    assert.equal(response.body.data.invitationSent, true);
    assert.equal(response.body.data.user.mustChangePassword, true);
    assert.equal(
      database.users.some((user) => user.email === "no-mail@example.com"),
      true,
    );
    assert.equal(database.emailOutbox.length, 1);

    await flushEmailOutbox();

    assert.equal(outbox.length, 0);
    const queuedEmail = database.emailOutbox[0];
    assert.ok(queuedEmail);
    assert.equal(queuedEmail.status, "PENDING");
    assert.equal(queuedEmail.attempts, 1);
  });

  it("blocks management routes while a password change is required", async () => {
    database.addUser({
      id: 3,
      email: "invited-admin@example.com",
      role: Role.ADMIN,
      password: TEST_PARTNER_PASSWORD,
    });
    const invitedAdmin = database.users.find(
      (user) => user.email === "invited-admin@example.com",
    );
    assert.ok(invitedAdmin);
    invitedAdmin.mustChangePassword = true;

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

  it("sends a password reset link from the admin endpoint and invalidates the previous invitation", async () => {
    const adminToken = (
      await login("admin@example.com", TEST_ADMIN_PASSWORD)
    ).token;
    const { userId, invitationToken } = await createInvitedUser(
      adminToken,
      "invitation-password@example.com",
    );

    const sendResponse = await request(app)
      .post(`/api/v1/users/${userId}/send-password-reset`)
      .set("Authorization", `Bearer ${adminToken}`);

    assert.equal(sendResponse.status, 200);
    assert.equal(sendResponse.body.data.emailSent, true);

    await flushEmailOutbox();

    const resetMail = outbox[outbox.length - 1];
    assert.ok(resetMail);
    assert.equal(resetMail.to, "invitation-password@example.com");
    const recoveryToken = extractTokenFromMail(resetMail);
    assert.notEqual(recoveryToken, invitationToken);

    // The previous invitation link is no longer usable.
    const oldLinkResponse = await request(app)
      .post("/api/v1/auth/reset-password")
      .send({ token: invitationToken, newPassword: TEST_ADMIN_PASSWORD });

    assert.equal(oldLinkResponse.status, 400);
    assert.equal(oldLinkResponse.body.code, "INVALID_RESET_TOKEN");

    // The new link lets the user define a personal password.
    const resetResponse = await request(app)
      .post("/api/v1/auth/reset-password")
      .send({ token: recoveryToken, newPassword: TEST_CHANGED_PASSWORD });

    assert.equal(resetResponse.status, 200);

    const session = await login(
      "invitation-password@example.com",
      TEST_CHANGED_PASSWORD,
    );
    assert.equal(session.mustChangePassword, false);

    const auditLog = database.auditLogs.find(
      (log) => log.action === "PASSWORD_RESET_LINK_SENT",
    );
    assert.ok(auditLog);
    assert.equal(auditLog.actorId, 1);
    assert.equal(auditLog.entityId, userId);
  });

  it("resends the invitation and invalidates the previous activation link", async () => {
    const adminToken = (
      await login("admin@example.com", TEST_ADMIN_PASSWORD)
    ).token;
    const { userId, invitationToken } = await createInvitedUser(
      adminToken,
      "resend-invitation@example.com",
    );

    const response = await request(app)
      .post(`/api/v1/users/${userId}/resend-invitation`)
      .set("Authorization", `Bearer ${adminToken}`);

    assert.equal(response.status, 200);
    assert.equal(response.body.message, "Invitación reenviada.");
    assert.equal(response.body.data.emailSent, true);

    await flushEmailOutbox();

    const resentMail = outbox[outbox.length - 1];
    assert.ok(resentMail);
    assert.equal(resentMail.to, "resend-invitation@example.com");
    assert.equal(
      resentMail.subject,
      "Bienvenido a HomeKeys Liberty - Activa tu cuenta",
    );
    const resentToken = extractTokenFromMail(resentMail);
    assert.notEqual(resentToken, invitationToken);

    const oldLinkResponse = await request(app)
      .post("/api/v1/auth/reset-password")
      .send({ token: invitationToken, newPassword: TEST_CHANGED_PASSWORD });

    assert.equal(oldLinkResponse.status, 400);
    assert.equal(oldLinkResponse.body.code, "INVALID_RESET_TOKEN");

    const activationResponse = await request(app)
      .post("/api/v1/auth/reset-password")
      .send({ token: resentToken, newPassword: TEST_CHANGED_PASSWORD });

    assert.equal(activationResponse.status, 200);

    const session = await login(
      "resend-invitation@example.com",
      TEST_CHANGED_PASSWORD,
    );
    assert.equal(session.mustChangePassword, false);

    const auditLog = database.auditLogs.find(
      (log) => log.action === "INVITATION_RESENT",
    );
    assert.ok(auditLog);
    assert.equal(auditLog.actorId, 1);
    assert.equal(auditLog.entityId, userId);
  });

  it("rejects resending invitations for activated, inactive or unauthorized accounts", async () => {
    const adminToken = (
      await login("admin@example.com", TEST_ADMIN_PASSWORD)
    ).token;

    const activatedResponse = await request(app)
      .post("/api/v1/users/2/resend-invitation")
      .set("Authorization", `Bearer ${adminToken}`);

    assert.equal(activatedResponse.status, 409);
    assert.equal(activatedResponse.body.code, "INVITATION_NOT_PENDING");

    const { userId } = await createInvitedUser(
      adminToken,
      "resend-inactive@example.com",
    );

    const deactivationResponse = await request(app)
      .patch(`/api/v1/users/${userId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ isActive: false });

    assert.equal(deactivationResponse.status, 200);

    const inactiveResponse = await request(app)
      .post(`/api/v1/users/${userId}/resend-invitation`)
      .set("Authorization", `Bearer ${adminToken}`);

    assert.equal(inactiveResponse.status, 409);
    assert.equal(inactiveResponse.body.code, "USER_INACTIVE");

    const partnerToken = (
      await login("partner@example.com", TEST_PARTNER_PASSWORD)
    ).token;

    const forbiddenResponse = await request(app)
      .post("/api/v1/users/1/resend-invitation")
      .set("Authorization", `Bearer ${partnerToken}`);

    assert.equal(forbiddenResponse.status, 403);
    assert.equal(forbiddenResponse.body.code, "ADMIN_REQUIRED");

    const missingResponse = await request(app)
      .post("/api/v1/users/999/resend-invitation")
      .set("Authorization", `Bearer ${adminToken}`);

    assert.equal(missingResponse.status, 404);
    assert.equal(missingResponse.body.code, "USER_NOT_FOUND");
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
    await flushEmailOutbox();

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
