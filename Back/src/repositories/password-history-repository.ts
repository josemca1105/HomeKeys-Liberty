import type { Prisma } from "@prisma/client";
import { prisma } from "../config/database";

type PasswordHistoryClient = Prisma.TransactionClient | typeof prisma;

export const findRecentPasswordHashes = async (
  userId: number,
  limit: number,
  client: PasswordHistoryClient = prisma,
): Promise<string[]> => {
  const entries = await client.passwordHistory.findMany({
    where: { userId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit,
    select: { passwordHash: true },
  });

  return entries.map((entry) => entry.passwordHash);
};

/**
 * Stores the password that is being replaced and prunes anything beyond the
 * configured window. Call it inside the same transaction that updates the
 * password so the history and the credential never disagree.
 */
export const recordPasswordHistoryEntry = async (
  userId: number,
  passwordHash: string,
  keep: number,
  client: Prisma.TransactionClient,
): Promise<void> => {
  await client.passwordHistory.create({
    data: { userId, passwordHash },
  });

  const staleEntries = await client.passwordHistory.findMany({
    where: { userId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip: keep,
    select: { id: true },
  });

  if (staleEntries.length > 0) {
    await client.passwordHistory.deleteMany({
      where: { id: { in: staleEntries.map((entry) => entry.id) } },
    });
  }
};
