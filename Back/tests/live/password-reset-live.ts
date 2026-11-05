/**
 * Live verification for the password recovery flow against PostgreSQL and the
 * real Gmail SMTP server configured in .env.
 *
 * This script is intentionally excluded from `npm test`. It creates a
 * temporary user, exercises the forgot/reset endpoints, delivers one real
 * recovery email to the configured mailbox, and removes every temporary row at
 * the end, including on failure. It never reads or modifies the seed data.
 *
 * Run from Back with:
 *   npx tsx tests/live/password-reset-live.ts
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

const LIVE_SUFFIX = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
const LIVE_INITIAL_PASSWORD = "Live-Initial-Password1!";
const LIVE_NEW_PASSWORD = "Live-New-Password1!";

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

const extractResetToken = (mail: OutgoingMail): string => {
  const match = /token=([0-9a-f]+)/.exec(mail.text);
  assert.ok(match);
  return match[1] as string;
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
  const userEmail = `live-reset-${LIVE_SUFFIX}@example.com`;

  const user = await prisma.user.create({
    data: {
      firstName: "Live",
      lastName: "Reset",
      email: userEmail,
      passwordHash: await hashPassword(LIVE_INITIAL_PASSWORD),
      phone: "00000000",
      role: Role.PARTNER,
    },
  });
  createdUserIds.push(user.id);

  // 1. Generic response whether the email exists or not.
  const unknownResponse = await request(app)
    .post("/api/v1/auth/forgot-password")
    .send({ email: `missing-${LIVE_SUFFIX}@example.com` });
  const knownResponse = await request(app)
    .post("/api/v1/auth/forgot-password")
    .send({ email: userEmail });

  assert.equal(unknownResponse.status, 200);
  assert.equal(knownResponse.status, 200);
  assert.deepEqual(unknownResponse.body, knownResponse.body);
  assert.equal(outbox.length, 1, "Only the registered email receives mail");

  // 2. The real email was delivered through Gmail SMTP.
  const delivery = await smtpTransport.verify();
  assert.equal(delivery, true);
  const mail = outbox[0];
  assert.ok(mail);
  assert.equal(mail.to, userEmail);
  assert.equal(
    mail.subject,
    "Restablece tu contraseña - HomeKeys Liberty",
  );
  const rawToken = extractResetToken(mail);
  assert.equal(rawToken.length, 64);

  // 3. Only the SHA-256 hash is persisted.
  const storedTokens = await prisma.passwordResetToken.findMany({
    where: { userId: user.id },
  });
  assert.equal(storedTokens.length, 1);
  const storedToken = storedTokens[0];
  assert.ok(storedToken);
  assert.equal(storedToken.tokenHash, hashToken(rawToken));
  assert.equal(
    JSON.stringify(storedTokens).includes(rawToken),
    false,
    "The raw token must never be persisted",
  );

  // 4. The password policy applies to the new password.
  const sessionToken = (
    await request(app)
      .post("/api/v1/auth/login")
      .send({ email: userEmail, password: LIVE_INITIAL_PASSWORD })
  ).body.data.token as string;
  assert.ok(sessionToken);

  const weakResponse = await request(app)
    .post("/api/v1/auth/reset-password")
    .send({ token: rawToken, newPassword: "abcdefgh1!" });

  assert.equal(weakResponse.status, 400);
  assert.equal(weakResponse.body.code, "VALIDATION_ERROR");

  // 5. Valid reset closes previous sessions.
  const resetResponse = await request(app)
    .post("/api/v1/auth/reset-password")
    .send({ token: rawToken, newPassword: LIVE_NEW_PASSWORD });

  assert.equal(resetResponse.status, 200);
  assert.equal(
    resetResponse.body.message,
    "Contraseña restablecida exitosamente.",
  );

  const staleSessionResponse = await request(app)
    .get("/api/v1/users/me")
    .set("Authorization", `Bearer ${sessionToken}`);

  assert.equal(staleSessionResponse.status, 401);
  assert.equal(staleSessionResponse.body.code, "SESSION_INVALIDATED");

  const oldLoginResponse = await request(app)
    .post("/api/v1/auth/login")
    .send({ email: userEmail, password: LIVE_INITIAL_PASSWORD });
  assert.equal(oldLoginResponse.status, 401);

  const newLoginResponse = await request(app)
    .post("/api/v1/auth/login")
    .send({ email: userEmail, password: LIVE_NEW_PASSWORD });
  assert.equal(newLoginResponse.status, 200);

  // 6. The token cannot be used twice.
  const reuseResponse = await request(app)
    .post("/api/v1/auth/reset-password")
    .send({ token: rawToken, newPassword: LIVE_INITIAL_PASSWORD });

  assert.equal(reuseResponse.status, 400);
  assert.equal(reuseResponse.body.code, "RESET_TOKEN_ALREADY_USED");

  // 7. Expired tokens are rejected.
  const expiredTokenResponse = await request(app)
    .post("/api/v1/auth/forgot-password")
    .send({ email: userEmail });
  assert.equal(expiredTokenResponse.status, 200);
  assert.equal(outbox.length, 2);
  const expiredRawToken = extractResetToken(outbox[1] as OutgoingMail);

  await prisma.passwordResetToken.updateMany({
    where: { userId: user.id, used: false },
    data: { expiresAt: new Date(Date.now() - 60 * 1000) },
  });

  const expiredResetResponse = await request(app)
    .post("/api/v1/auth/reset-password")
    .send({ token: expiredRawToken, newPassword: LIVE_INITIAL_PASSWORD });

  assert.equal(expiredResetResponse.status, 400);
  assert.equal(expiredResetResponse.body.code, "RESET_TOKEN_EXPIRED");
};

const main = async (): Promise<void> => {
  try {
    await run();
  } finally {
    await cleanup();

    const leftoverUsers = await prisma.user.count({
      where: { email: { contains: `-${LIVE_SUFFIX}@` } },
    });
    assert.equal(
      leftoverUsers,
      0,
      "Temporary live users must be removed after the verification",
    );

    await prisma.$disconnect();
  }

  console.log(
    `Live password recovery verification passed (${outbox.length} real emails delivered through Gmail SMTP).`,
  );
};

main().catch((error: unknown) => {
  console.error("Live password recovery verification failed.", error);
  process.exitCode = 1;
});
