/**
 * Live verification for the user management endpoints against PostgreSQL.
 *
 * This script is intentionally excluded from `npm test`. It creates temporary
 * users through the HTTP API and directly through Prisma, exercises the edit
 * and delete flows, and removes every temporary row at the end, including on
 * failure. It never reads or modifies the administrator seed.
 *
 * Run from Back with:
 *   npx tsx tests/live/user-management-live.ts
 */
import assert from "node:assert/strict";
import type { Express } from "express";
import request from "supertest";
import { Role } from "@prisma/client";
import { createApp } from "../../src/app";
import { prisma } from "../../src/config/database";
import type { OutgoingMail } from "../../src/utils/mailer";
import { setMailSenderForTesting } from "../../src/utils/mailer";
import { hashPassword } from "../../src/utils/password";

const LIVE_SUFFIX = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
const LIVE_ADMIN_PASSWORD = "Live-Admin-Password1!";
const LIVE_PARTNER_PASSWORD = "Live-Partner-Password1!";
const LIVE_CHANGED_PASSWORD = "Live-Changed-Password1!";

const app: Express = createApp();
const outbox: OutgoingMail[] = [];
const createdUserIds: number[] = [];
const createdPropertyIds: number[] = [];

// Capture-only sender: temporary users use fake addresses, so nothing is
// really delivered during this check.
setMailSenderForTesting({
  sendMail: async (options: OutgoingMail): Promise<unknown> => {
    outbox.push(options);
    return { accepted: [options.to] };
  },
});

const cleanup = async (): Promise<void> => {
  if (createdPropertyIds.length > 0) {
    await prisma.photo.deleteMany({
      where: { propertyId: { in: createdPropertyIds } },
    });
    await prisma.property.deleteMany({
      where: { id: { in: createdPropertyIds } },
    });
  }

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

const assertNoPasswordHash = (body: unknown): void => {
  assert.equal(
    JSON.stringify(body).includes("passwordHash"),
    false,
    "Response body must never contain passwordHash",
  );
};

const login = async (
  email: string,
  password: string,
): Promise<string | null> => {
  const response = await request(app)
    .post("/api/v1/auth/login")
    .send({ email, password });

  if (response.status !== 200) {
    return null;
  }

  assertNoPasswordHash(response.body);
  return response.body.data.token as string;
};

const run = async (): Promise<void> => {
  const adminEmail = `live-admin-${LIVE_SUFFIX}@example.com`;
  const secondAdminEmail = `live-admin-2-${LIVE_SUFFIX}@example.com`;
  const victimEmail = `live-victim-${LIVE_SUFFIX}@example.com`;
  const agentEmail = `live-agent-${LIVE_SUFFIX}@example.com`;
  const createdEmail = `live-created-${LIVE_SUFFIX}@example.com`;

  const [adminUser, secondAdminUser, victimUser, agentUser] = await Promise.all([
    prisma.user.create({
      data: {
        firstName: "Live",
        lastName: "Administrator",
        email: adminEmail,
        passwordHash: await hashPassword(LIVE_ADMIN_PASSWORD),
        phone: "00000000",
        role: Role.ADMIN,
      },
    }),
    prisma.user.create({
      data: {
        firstName: "Live",
        lastName: "Second Administrator",
        email: secondAdminEmail,
        passwordHash: await hashPassword(LIVE_ADMIN_PASSWORD),
        phone: "00000000",
        role: Role.ADMIN,
      },
    }),
    prisma.user.create({
      data: {
        firstName: "Live",
        lastName: "Victim",
        email: victimEmail,
        passwordHash: await hashPassword(LIVE_PARTNER_PASSWORD),
        phone: "00000000",
        role: Role.PARTNER,
      },
    }),
    prisma.user.create({
      data: {
        firstName: "Live",
        lastName: "Agent",
        email: agentEmail,
        passwordHash: await hashPassword(LIVE_PARTNER_PASSWORD),
        phone: "00000000",
        role: Role.PARTNER,
      },
    }),
  ]);

  createdUserIds.push(
    adminUser.id,
    secondAdminUser.id,
    victimUser.id,
    agentUser.id,
  );

  const property = await prisma.property.create({
    data: {
      agentId: agentUser.id,
      code: `LIVE-${LIVE_SUFFIX}`,
      category: "House",
      city: "Caracas",
      state: "Distrito Capital",
      address: "Av. Principal",
      price: 100000,
      bathrooms: 2,
      bedrooms: 3,
      parkingSpaces: 1,
      type: "Sale",
      squareMeters: 120,
    },
  });
  createdPropertyIds.push(property.id);

  const futureDate = new Date(Date.now() + 60 * 60 * 1000);
  await prisma.revokedToken.createMany({
    data: [
      {
        tokenHash: `live-revoked-${LIVE_SUFFIX}-victim`,
        userId: victimUser.id,
        expiresAt: futureDate,
      },
      {
        tokenHash: `live-revoked-${LIVE_SUFFIX}-agent`,
        userId: agentUser.id,
        expiresAt: futureDate,
      },
    ],
  });
  await prisma.passwordResetToken.createMany({
    data: [
      {
        tokenHash: `live-reset-${LIVE_SUFFIX}-victim`,
        userId: victimUser.id,
        expiresAt: futureDate,
      },
      {
        tokenHash: `live-reset-${LIVE_SUFFIX}-agent`,
        userId: agentUser.id,
        expiresAt: futureDate,
      },
    ],
  });

  const adminToken = await login(adminEmail, LIVE_ADMIN_PASSWORD);
  assert.ok(adminToken, "Live admin must be able to log in");
  const victimToken = await login(victimEmail, LIVE_PARTNER_PASSWORD);
  assert.ok(victimToken, "Live victim must be able to log in");

  // 1. ADMIN creates a user through the API; the invitation arrives by email.
  const createResponse = await request(app)
    .post("/api/v1/users/add")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({
      firstName: "Live",
      lastName: "Created",
      email: createdEmail.toUpperCase(),
      phone: "00000000",
      photoUrl: null,
    });

  assert.equal(createResponse.status, 201);
  assertNoPasswordHash(createResponse.body);
  assert.equal(createResponse.body.data.invitationSent, true);
  assert.equal("temporaryPassword" in createResponse.body.data, false);
  assert.equal(createResponse.body.data.user.mustChangePassword, true);
  const createdUserId = createResponse.body.data.user.id as number;
  createdUserIds.push(createdUserId);
  assert.equal(createResponse.body.data.user.email, createdEmail);

  // The activation link defines the initial personal password.
  const invitationMail = outbox[outbox.length - 1];
  assert.ok(invitationMail);
  const activationTokenMatch = /token=([0-9a-f]{64})/.exec(
    invitationMail.text,
  );
  assert.ok(activationTokenMatch);
  const activationResponse = await request(app)
    .post("/api/v1/auth/reset-password")
    .send({
      token: activationTokenMatch[1],
      newPassword: LIVE_PARTNER_PASSWORD,
    });
  assert.equal(activationResponse.status, 200);

  // 2. ADMIN edits every editable field of the created user.
  const updateResponse = await request(app)
    .patch(`/api/v1/users/${createdUserId}`)
    .set("Authorization", `Bearer ${adminToken}`)
    .send({
      firstName: "Live",
      lastName: "Updated",
      phone: "04121234567",
      photoUrl: null,
    });

  assert.equal(updateResponse.status, 200);
  assertNoPasswordHash(updateResponse.body);
  assert.equal(updateResponse.body.data.user.lastName, "Updated");
  assert.equal(updateResponse.body.data.user.phone, "04121234567");

  // 3. Duplicate email during edit.
  const duplicateResponse = await request(app)
    .patch(`/api/v1/users/${createdUserId}`)
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ email: victimEmail });

  assert.equal(duplicateResponse.status, 409);
  assert.equal(duplicateResponse.body.code, "EMAIL_ALREADY_REGISTERED");

  // 4. The created user changes its own password and old sessions die.
  const createdToken = await login(createdEmail, LIVE_PARTNER_PASSWORD);
  assert.ok(createdToken);

  const changePasswordResponse = await request(app)
    .patch("/api/v1/users/me/password")
    .set("Authorization", `Bearer ${createdToken}`)
    .send({
      currentPassword: LIVE_PARTNER_PASSWORD,
      newPassword: LIVE_CHANGED_PASSWORD,
    });

  assert.equal(changePasswordResponse.status, 200);
  assertNoPasswordHash(changePasswordResponse.body);
  const freshToken = changePasswordResponse.body.data.token as string;
  assert.ok(freshToken);

  const staleSessionResponse = await request(app)
    .get("/api/v1/users/me")
    .set("Authorization", `Bearer ${createdToken}`);

  assert.equal(staleSessionResponse.status, 401);
  assert.equal(staleSessionResponse.body.code, "SESSION_INVALIDATED");

  const freshSessionResponse = await request(app)
    .get("/api/v1/users/me")
    .set("Authorization", `Bearer ${freshToken}`);

  assert.equal(freshSessionResponse.status, 200);

  const reloginToken = await login(createdEmail, LIVE_CHANGED_PASSWORD);
  assert.ok(reloginToken, "The new password must work after the change");

  // 5. ADMIN resets another user's password and closes that user's sessions.
  const resetResponse = await request(app)
    .patch(`/api/v1/users/${victimUser.id}`)
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ password: LIVE_CHANGED_PASSWORD });

  assert.equal(resetResponse.status, 200);
  assert.equal("token" in resetResponse.body.data, false);

  const victimStaleResponse = await request(app)
    .get("/api/v1/users/me")
    .set("Authorization", `Bearer ${victimToken}`);

  assert.equal(victimStaleResponse.status, 401);
  assert.equal(victimStaleResponse.body.code, "SESSION_INVALIDATED");

  // 6. Deletion guards.
  const selfDeleteResponse = await request(app)
    .delete(`/api/v1/users/${adminUser.id}`)
    .set("Authorization", `Bearer ${adminToken}`);

  assert.equal(selfDeleteResponse.status, 409);
  assert.equal(selfDeleteResponse.body.code, "SELF_DELETION_NOT_ALLOWED");

  const agentDeleteResponse = await request(app)
    .delete(`/api/v1/users/${agentUser.id}`)
    .set("Authorization", `Bearer ${adminToken}`);

  assert.equal(agentDeleteResponse.status, 409);
  assert.equal(agentDeleteResponse.body.code, "USER_HAS_PROPERTIES");

  // 7. ADMIN deletes a user without relations and the token rows are cleaned.
  const deleteResponse = await request(app)
    .delete(`/api/v1/users/${victimUser.id}`)
    .set("Authorization", `Bearer ${adminToken}`);

  assert.equal(deleteResponse.status, 200);
  assertNoPasswordHash(deleteResponse.body);
  assert.equal(deleteResponse.body.data.deletedId, victimUser.id);

  const missingUserResponse = await request(app)
    .get(`/api/v1/users/${victimUser.id}`)
    .set("Authorization", `Bearer ${adminToken}`);

  assert.equal(missingUserResponse.status, 404);

  const victimTokenRows = await prisma.revokedToken.count({
    where: { userId: victimUser.id },
  });
  const victimResetRows = await prisma.passwordResetToken.count({
    where: { userId: victimUser.id },
  });
  const agentResetRows = await prisma.passwordResetToken.count({
    where: { userId: agentUser.id },
  });

  assert.equal(victimTokenRows, 0);
  assert.equal(victimResetRows, 0);
  assert.equal(agentResetRows, 1);

  // 8. Password policy rejections on the three password entry points.
  const weakCreateResponse = await request(app)
    .post("/api/v1/users/add")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({
      firstName: "Live",
      lastName: "Weak",
      email: `live-weak-${LIVE_SUFFIX}@example.com`,
      password: "abcdefgh1!",
      phone: "00000000",
    });

  assert.equal(weakCreateResponse.status, 400);
  assert.equal(weakCreateResponse.body.code, "VALIDATION_ERROR");

  const weakChangeResponse = await request(app)
    .patch("/api/v1/users/me/password")
    .set("Authorization", `Bearer ${freshToken}`)
    .send({
      currentPassword: LIVE_CHANGED_PASSWORD,
      newPassword: "abcdefgh1!",
    });

  assert.equal(weakChangeResponse.status, 400);
  assert.equal(weakChangeResponse.body.code, "VALIDATION_ERROR");

  const weakResetResponse = await request(app)
    .patch(`/api/v1/users/${agentUser.id}`)
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ password: "abcdefgh1!" });

  assert.equal(weakResetResponse.status, 400);
  assert.equal(weakResetResponse.body.code, "VALIDATION_ERROR");
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

  console.log("Live user management verification passed.");
};

main().catch((error: unknown) => {
  console.error("Live user management verification failed.", error);
  process.exitCode = 1;
});
