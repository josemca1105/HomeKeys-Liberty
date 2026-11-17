/**
 * Live verification for transactional audit against PostgreSQL.
 *
 * The automated suite uses Prisma test doubles, so this check proves on a real
 * database that a business update and its audit row share one transaction: if
 * the audit insert fails, the business update is rolled back.
 *
 * Run from Back with:
 *   npx tsx tests/live/audit-transaction-live.ts
 */
import assert from "node:assert/strict";
import { AuditScope, Role } from "@prisma/client";
import { prisma } from "../../src/config/database";
import { hashPassword } from "../../src/utils/password";

const LIVE_SUFFIX = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
const LIVE_EMAIL = `audit-transaction-${LIVE_SUFFIX}@example.com`;
const ROLLED_BACK_NAME = "ShouldNotPersist";

const run = async (): Promise<void> => {
  let userId: number | null = null;

  try {
    const passwordHash = await hashPassword("Live-Audit-Transaction1!");
    const user = await prisma.user.create({
      data: {
        firstName: "Audit",
        lastName: "Transaction",
        email: LIVE_EMAIL,
        passwordHash,
        phone: "00000000",
        role: Role.PARTNER,
      },
    });
    userId = user.id;

    // The action exceeds the VARCHAR(80) audit column, so the insert fails
    // after the user update. Both statements share the transaction, so the
    // update must roll back with it.
    await assert.rejects(
      () =>
        prisma.$transaction(async (transaction) => {
          await transaction.user.update({
            where: { id: user.id },
            data: { firstName: ROLLED_BACK_NAME },
          });

          await transaction.auditLog.create({
            data: {
              scope: AuditScope.SECURITY,
              action: "X".repeat(100),
              requestId: "live-audit-transaction",
            },
          });
        }),
      (error: unknown) => error instanceof Error,
      "The transaction must fail when the audit insert is invalid",
    );

    const afterFailure = await prisma.user.findUnique({
      where: { id: user.id },
    });
    assert.ok(afterFailure);
    assert.notEqual(
      afterFailure.firstName,
      ROLLED_BACK_NAME,
      "The user update must roll back with the failed audit insert",
    );

    console.log("Transactional audit check passed.");
  } finally {
    if (userId !== null) {
      await prisma.user.deleteMany({ where: { id: userId } });
    }
    await prisma.$disconnect();
  }
};

void run().catch((error: unknown): void => {
  console.error("Transactional audit check failed.", error);
  process.exit(1);
});
