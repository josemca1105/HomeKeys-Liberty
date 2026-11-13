import type { LoginAttempt } from "@prisma/client";
import { prisma } from "../config/database";
import { runSerializableTransaction } from "./serializable-transaction";

export const findLoginAttemptByEmail = async (
  email: string,
): Promise<LoginAttempt | null> => {
  return prisma.loginAttempt.findUnique({
    where: { email },
  });
};

export interface RegisterFailedLoginAttemptOptions {
  email: string;
  now: Date;
  maxAttempts: number;
  lockDurationMs: number;
}

/**
 * Counts a failed login for the submitted email. Once the threshold is
 * reached, the email is locked for the configured duration and the counter is
 * reset so the next failure after the lock expires starts a fresh window.
 *
 * The row is keyed by email rather than by user id: unknown emails are tracked
 * too, so a locked response cannot be used to discover registered accounts.
 */
export const registerFailedLoginAttempt = async ({
  email,
  now,
  maxAttempts,
  lockDurationMs,
}: RegisterFailedLoginAttemptOptions): Promise<void> => {
  await runSerializableTransaction(async (transaction) => {
    const current = await transaction.loginAttempt.findUnique({
      where: { email },
    });

    const isLockExpired =
      current !== null &&
      current.lockedUntil !== null &&
      current.lockedUntil.getTime() <= now.getTime();

    const previousAttempts =
      current === null || isLockExpired ? 0 : current.failedAttempts;
    const attempts = previousAttempts + 1;
    const shouldLock = attempts >= maxAttempts;

    const failedAttempts = shouldLock ? 0 : attempts;
    const lockedUntil = shouldLock
      ? new Date(now.getTime() + lockDurationMs)
      : null;

    await transaction.loginAttempt.upsert({
      where: { email },
      create: { email, failedAttempts, lockedUntil },
      update: { failedAttempts, lockedUntil },
    });
  });
};

export const clearLoginAttempts = async (email: string): Promise<void> => {
  await prisma.loginAttempt.deleteMany({
    where: { email },
  });
};

export const deleteStaleLoginAttempts = async (
  updatedBefore: Date,
): Promise<number> => {
  const result = await prisma.loginAttempt.deleteMany({
    where: {
      updatedAt: { lt: updatedBefore },
    },
  });

  return result.count;
};
