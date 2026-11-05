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

  // 3. Explicit password: the welcome email never contains it and the user is
  // forced to define a personal password before managing anything.
  const explicitResponse = await request(app)
    .post("/api/v1/users/add")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({
      firstName: "Live",
      lastName: "Explicit",
      email: explicitEmail,
      password: LIVE_EXPLICIT_PASSWORD,
      phone: "00000000",
      photoUrl: null,
      role: Role.ADMIN,
    });

  assert.equal(explicitResponse.status, 201);
  assert.equal(explicitResponse.body.data.invitationSent, true);
  createdUserIds.push(explicitResponse.body.data.user.id as number);

  const explicitMail = outbox[outbox.length - 1];
  assert.ok(explicitMail);
  assert.equal(explicitMail.html.includes(LIVE_EXPLICIT_PASSWORD), false);
  assert.equal(explicitMail.text.includes(LIVE_EXPLICIT_PASSWORD), false);

  const explicitSession = await login(explicitEmail, LIVE_EXPLICIT_PASSWORD);
  assert.equal(explicitSession.mustChangePassword, true);

  const blockedResponse = await request(app)
    .get("/api/v1/users")
    .set("Authorization", `Bearer ${explicitSession.token}`);
  assert.equal(blockedResponse.status, 403);
  assert.equal(blockedResponse.body.code, "PASSWORD_CHANGE_REQUIRED");

  const changeResponse = await request(app)
    .patch("/api/v1/users/me/password")
    .set("Authorization", `Bearer ${explicitSession.token}`)
    .send({
      currentPassword: LIVE_EXPLICIT_PASSWORD,
      newPassword: LIVE_FINAL_PASSWORD,
    });
  assert.equal(changeResponse.status, 200);
  assert.equal(changeResponse.body.data.user.mustChangePassword, false);

  const restoredToken = changeResponse.body.data.token as string;
  const restoredResponse = await request(app)
    .get("/api/v1/users")
    .set("Authorization", `Bearer ${restoredToken}`);
  assert.equal(restoredResponse.status, 200);

  // 4. ADMIN reset forces a new password change and notifies by email.
  const resetUserId = explicitResponse.body.data.user.id as number;
  const adminResetResponse = await request(app)
    .patch(`/api/v1/users/${resetUserId}`)
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ password: LIVE_EXPLICIT_PASSWORD });

  assert.equal(adminResetResponse.status, 200);
  assert.equal(adminResetResponse.body.data.user.mustChangePassword, true);

  const noticeMail = outbox[outbox.length - 1];
  assert.ok(noticeMail);
  assert.equal(noticeMail.to, explicitEmail);
  assert.equal(
    noticeMail.subject,
    "Tu contraseña fue restablecida - HomeKeys Liberty",
  );
  assert.equal(noticeMail.html.includes(LIVE_EXPLICIT_PASSWORD), false);

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
