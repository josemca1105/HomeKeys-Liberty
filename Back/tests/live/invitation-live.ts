/**
 * Live verification for the invitation and forced password change flows
 * against PostgreSQL and the real Gmail SMTP server configured in .env.
 *
 * This script is intentionally excluded from `npm test`. It creates temporary
 * users with plus-addressed real mailboxes, so the welcome and notice emails
 * really arrive at the configured Gmail inbox for visual review. Every
 * temporary row is removed at the end, including on failure. It never reads or
 * modifies the seed data.
 *
 * Run from Back with:
 *   npx tsx tests/live/invitation-live.ts
 */
import assert from "node:assert/strict";
import type { Express } from "express";
import nodemailer from "nodemailer";
import request from "supertest";
import { Role } from "@prisma/client";
import { createApp } from "../../src/app";
import { environment } from "../../src/config/env";
import { prisma } from "../../src/config/database";
import type { OutgoingMail } from "../../src/utils/mailer";
import { setMailSenderForTesting } from "../../src/utils/mailer";
import { hashPassword } from "../../src/utils/password";
import { hashToken } from "../../src/utils/token";
import { processEmailOutboxBatch } from "../../src/services/email-outbox-service";

const LIVE_RUN = `${Date.now()}`;
const LIVE_ADMIN_PASSWORD = "Live-Admin-Password1!";
const LIVE_SET_PASSWORD = "Live-Set-Password1!";
const LIVE_EXPLICIT_PASSWORD = "Live-Explicit-Password1!";
const LIVE_FINAL_PASSWORD = "Live-Final-Password1!";

const buildLiveEmail = (tag: string): string => {
  return `jm.calderon1105+liveinv${tag}${LIVE_RUN}@gmail.com`;
};

const app: Express = createApp();
const outbox: OutgoingMail[] = [];
const createdUserIds: number[] = [];

const smtpTransport = nodemailer.createTransport({
  host: environment.SMTP_HOST,
  port: environment.SMTP_PORT,
  secure: environment.SMTP_SECURE,
  auth: {
    user: environment.SMTP_USER,
    pass: environment.SMTP_APP_PASSWORD,
  },
});

setMailSenderForTesting({
  sendMail: async (options: OutgoingMail): Promise<unknown> => {
    const deliveryInfo = await smtpTransport.sendMail(options);
    outbox.push(options);
    return deliveryInfo;
  },
});

const extractToken = (mail: OutgoingMail): string => {
  const match = /token=([0-9a-f]{64})/.exec(mail.text);
  assert.ok(match);
  return match[1] as string;
};

const deliverQueuedEmails = async (): Promise<void> => {
  await processEmailOutboxBatch({ limit: 100 });
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

const cleanup = async (): Promise<void> => {
  if (createdUserIds.length > 0) {
    await prisma.revokedToken.deleteMany({
      where: { userId: { in: createdUserIds } },
    });
    await prisma.passwordResetToken.deleteMany({
      where: { userId: { in: createdUserIds } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: createdUserIds } },
    });
  }
};

const run = async (): Promise<void> => {
  const adminEmail = buildLiveEmail("admin");
  const invitedEmail = buildLiveEmail("inv");
  const explicitEmail = buildLiveEmail("exp");
  const expiredEmail = buildLiveEmail("expd");

  const adminUser = await prisma.user.create({
    data: {
      firstName: "Live",
      lastName: "Administrator",
      email: adminEmail,
      passwordHash: await hashPassword(LIVE_ADMIN_PASSWORD),
      phone: "00000000",
      role: Role.ADMIN,
    },
  });
  createdUserIds.push(adminUser.id);

  const { token: adminToken } = await login(adminEmail, LIVE_ADMIN_PASSWORD);

  // 1. Welcome invitation really delivered to the plus-addressed mailbox.
  const createResponse = await request(app)
    .post("/api/v1/users/add")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({
      firstName: "Live",
      lastName: "Invited",
      email: invitedEmail,
      phone: "00000000",
      photoUrl: null,
    });

  assert.equal(createResponse.status, 201);
  assert.equal(createResponse.body.data.invitationSent, true);
  assert.equal(createResponse.body.data.user.mustChangePassword, true);
  assert.equal("temporaryPassword" in createResponse.body.data, false);
  createdUserIds.push(createResponse.body.data.user.id as number);

  await deliverQueuedEmails();

  const invitationMail = outbox[outbox.length - 1];
  assert.ok(invitationMail);
  assert.equal(invitationMail.to, invitedEmail);
  assert.equal(
    invitationMail.subject,
    "Bienvenido a HomeKeys Liberty - Activa tu cuenta",
  );
  assert.equal(invitationMail.html.includes("cid:homekeys-logo"), true);
  assert.equal(invitationMail.html.includes("Activar mi cuenta"), true);
  assert.equal(/passwordHash/.test(invitationMail.html), false);

  // 2. The activation link defines the personal password and clears the flag.
  const activationToken = extractToken(invitationMail);
  const activationResponse = await request(app)
    .post("/api/v1/auth/reset-password")
    .send({ token: activationToken, newPassword: LIVE_SET_PASSWORD });

  assert.equal(activationResponse.status, 200);

  const activatedSession = await login(invitedEmail, LIVE_SET_PASSWORD);
  assert.equal(activatedSession.mustChangePassword, false);

  // 3. Resending the invitation invalidates the previous activation link.
  const resendCreateResponse = await request(app)
    .post("/api/v1/users/add")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({
      firstName: "Live",
      lastName: "Resend",
      email: explicitEmail,
      phone: "00000000",
      photoUrl: null,
      role: Role.ADMIN,
    });

  assert.equal(resendCreateResponse.status, 201);
  assert.equal(resendCreateResponse.body.data.invitationSent, true);
  const resendUserId = resendCreateResponse.body.data.user.id as number;
  createdUserIds.push(resendUserId);

  await deliverQueuedEmails();
  const firstInvitationMail = outbox[outbox.length - 1];
  assert.ok(firstInvitationMail);
  const firstInvitationToken = extractToken(firstInvitationMail);

  const resendResponse = await request(app)
    .post(`/api/v1/users/${resendUserId}/resend-invitation`)
    .set("Authorization", `Bearer ${adminToken}`);

  assert.equal(resendResponse.status, 200);
  assert.equal(resendResponse.body.data.emailSent, true);

  await deliverQueuedEmails();
  const resentMail = outbox[outbox.length - 1];
  assert.ok(resentMail);
  const resentToken = extractToken(resentMail);
  assert.notEqual(resentToken, firstInvitationToken);

  const oldInvitationResponse = await request(app)
    .post("/api/v1/auth/reset-password")
    .send({ token: firstInvitationToken, newPassword: LIVE_SET_PASSWORD });
  assert.equal(oldInvitationResponse.status, 400);
  assert.equal(oldInvitationResponse.body.code, "INVALID_RESET_TOKEN");

  const resentActivationResponse = await request(app)
    .post("/api/v1/auth/reset-password")
    .send({ token: resentToken, newPassword: LIVE_EXPLICIT_PASSWORD });
  assert.equal(resentActivationResponse.status, 200);

  const resentSession = await login(explicitEmail, LIVE_EXPLICIT_PASSWORD);
  assert.equal(resentSession.mustChangePassword, false);

  // 4. ADMIN sends a reset link; the user defines the password.
  const sendLinkResponse = await request(app)
    .post(`/api/v1/users/${resendUserId}/send-password-reset`)
    .set("Authorization", `Bearer ${adminToken}`);

  assert.equal(sendLinkResponse.status, 200);
  assert.equal(sendLinkResponse.body.data.emailSent, true);

  await deliverQueuedEmails();
  const resetMail = outbox[outbox.length - 1];
  assert.ok(resetMail);
  assert.equal(resetMail.to, explicitEmail);
  assert.equal(
    resetMail.subject,
    "Restablece tu contraseña - HomeKeys Liberty",
  );
  assert.equal(resetMail.html.includes(LIVE_EXPLICIT_PASSWORD), false);

  const resetToken = extractToken(resetMail);
  const resetResponse = await request(app)
    .post("/api/v1/auth/reset-password")
    .send({ token: resetToken, newPassword: LIVE_FINAL_PASSWORD });
  assert.equal(resetResponse.status, 200);

  const finalSession = await login(explicitEmail, LIVE_FINAL_PASSWORD);
  assert.equal(finalSession.mustChangePassword, false);

  // 5. Expired invitation links are rejected and can be replaced through the
  // recovery flow.
  const expiredResponse = await request(app)
    .post("/api/v1/users/add")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({
      firstName: "Live",
      lastName: "Expired",
      email: expiredEmail,
      phone: "00000000",
      photoUrl: null,
    });

  assert.equal(expiredResponse.status, 201);
  const expiredUserId = expiredResponse.body.data.user.id as number;
  createdUserIds.push(expiredUserId);

  await deliverQueuedEmails();
  const expiredToken = extractToken(outbox[outbox.length - 1] as OutgoingMail);

  await prisma.passwordResetToken.updateMany({
    where: { userId: expiredUserId, used: false },
    data: { expiresAt: new Date(Date.now() - 60 * 1000) },
  });

  const expiredActivationResponse = await request(app)
    .post("/api/v1/auth/reset-password")
    .send({ token: expiredToken, newPassword: LIVE_SET_PASSWORD });

  assert.equal(expiredActivationResponse.status, 400);
  assert.equal(expiredActivationResponse.body.code, "RESET_TOKEN_EXPIRED");

  // The invitation token is stored only as a SHA-256 hash.
  const storedTokens = await prisma.passwordResetToken.findMany({
    where: { userId: expiredUserId },
  });
  assert.equal(
    JSON.stringify(storedTokens).includes(expiredToken),
    false,
    "The raw activation token must never be persisted",
  );
  assert.equal(storedTokens[0]?.tokenHash, hashToken(expiredToken));
};

const main = async (): Promise<void> => {
  try {
    await run();
  } finally {
    await cleanup();

    const leftoverUsers = await prisma.user.count({
      where: { email: { contains: `${LIVE_RUN}@` } },
    });
    assert.equal(
      leftoverUsers,
      0,
      "Temporary live users must be removed after the verification",
    );

    await prisma.$disconnect();
  }

  console.log(
    `Live invitation verification passed (${outbox.length} real branded emails delivered to the plus-addressed mailbox).`,
  );
};

main().catch((error: unknown) => {
  console.error("Live invitation verification failed.", error);
  process.exitCode = 1;
});
