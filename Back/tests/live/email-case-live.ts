/**
 * Live verification for the case-insensitive email column against PostgreSQL.
 *
 * This script is intentionally excluded from `npm test` because the automated
 * suite uses Prisma test doubles. It creates one temporary user with a
 * mixed-case email, proves that the database rejects a case-variant duplicate
 * and that a lowercase lookup finds the row, then removes every temporary row.
 *
 * Run from Back with:
 *   npx tsx tests/live/email-case-live.ts
 */
import assert from "node:assert/strict";
import { Prisma, Role } from "@prisma/client";
import { prisma } from "../../src/config/database";
import { hashPassword } from "../../src/utils/password";

const LIVE_SUFFIX = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
const MIXED_CASE_EMAIL = `Case-Check-${LIVE_SUFFIX}@Example.COM`;

const buildUserData = (email: string): Prisma.UserCreateInput => {
  return {
    firstName: "Case",
    lastName: "Check",
    email,
    passwordHash: "not-used",
    phone: "00000000",
    role: Role.PARTNER,
  };
};

const run = async (): Promise<void> => {
  try {
    const passwordHash = await hashPassword("Live-Email-Case-Password1!");
    const created = await prisma.user.create({
      data: {
        ...buildUserData(MIXED_CASE_EMAIL),
        passwordHash,
      },
    });

    const foundByLowercase = await prisma.user.findUnique({
      where: { email: MIXED_CASE_EMAIL.toLowerCase() },
    });
    assert.equal(
      foundByLowercase?.id,
      created.id,
      "A lowercase lookup must find the mixed-case email",
    );

    await assert.rejects(
      () =>
        prisma.user.create({
          data: buildUserData(MIXED_CASE_EMAIL.toUpperCase()),
        }),
      (error: unknown) =>
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002",
      "The database must reject a case-variant duplicate email",
    );

    console.log("Email case-insensitive check passed.");
  } finally {
    // citext equality is case-insensitive, so this removes any case variant.
    await prisma.user.deleteMany({
      where: { email: MIXED_CASE_EMAIL },
    });
    await prisma.$disconnect();
  }
};

void run().catch((error: unknown): void => {
  console.error("Email case-insensitive check failed.", error);
  process.exit(1);
});
