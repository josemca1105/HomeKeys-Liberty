import type { EmailOutbox, EmailType, Prisma } from "@prisma/client";
import { prisma } from "../config/database";

type EmailOutboxClient = Prisma.TransactionClient | typeof prisma;

export interface EnqueueEmailData {
  type: EmailType;
  to: string;
  payload: Prisma.InputJsonValue;
  maxAttempts?: number;
  nextAttemptAt?: Date;
}

export const enqueueEmail = async (
  data: EnqueueEmailData,
  client: EmailOutboxClient = prisma,
): Promise<EmailOutbox> => {
  return client.emailOutbox.create({
    data: {
      type: data.type,
      to: data.to,
      payload: data.payload,
      ...(data.maxAttempts !== undefined
        ? { maxAttempts: data.maxAttempts }
        : {}),
      ...(data.nextAttemptAt !== undefined
        ? { nextAttemptAt: data.nextAttemptAt }
        : {}),
    },
  });
};

export const findPendingEmails = async (
  now: Date,
  limit: number,
  client: EmailOutboxClient = prisma,
): Promise<EmailOutbox[]> => {
  return client.emailOutbox.findMany({
    where: {
      status: "PENDING",
      nextAttemptAt: { lte: now },
    },
    orderBy: [{ nextAttemptAt: "asc" }, { id: "asc" }],
    take: limit,
  });
};

export const claimEmail = async (
  id: number,
  now: Date,
  client: EmailOutboxClient = prisma,
): Promise<boolean> => {
  const result = await client.emailOutbox.updateMany({
    where: {
      id,
      status: "PENDING",
      nextAttemptAt: { lte: now },
    },
    data: {
      status: "SENDING",
      lockedAt: now,
    },
  });

  return result.count === 1;
};

export const markEmailSent = async (
  id: number,
  sentAt: Date,
  client: EmailOutboxClient = prisma,
): Promise<void> => {
  await client.emailOutbox.update({
    where: { id },
    data: {
      status: "SENT",
      sentAt,
      lockedAt: null,
      lastError: null,
    },
  });
};

export interface MarkEmailFailedData {
  attempts: number;
  maxAttempts: number;
  nextAttemptAt: Date;
  error: string;
}

export const markEmailFailed = async (
  id: number,
  data: MarkEmailFailedData,
  client: EmailOutboxClient = prisma,
): Promise<void> => {
  await client.emailOutbox.update({
    where: { id },
    data: {
      status: data.attempts >= data.maxAttempts ? "FAILED" : "PENDING",
      attempts: data.attempts,
      nextAttemptAt: data.nextAttemptAt,
      lockedAt: null,
      lastError: data.error.slice(0, 500),
    },
  });
};

// A process can crash after claiming an email. Releasing old SENDING rows makes
// them eligible again instead of leaving them stuck forever.
export const releaseStaleSendingEmails = async (
  lockedBefore: Date,
  client: EmailOutboxClient = prisma,
): Promise<number> => {
  const result = await client.emailOutbox.updateMany({
    where: {
      status: "SENDING",
      lockedAt: { lt: lockedBefore },
    },
    data: {
      status: "PENDING",
      lockedAt: null,
    },
  });

  return result.count;
};

export const deleteOldEmails = async (
  createdBefore: Date,
  client: EmailOutboxClient = prisma,
): Promise<number> => {
  const result = await client.emailOutbox.deleteMany({
    where: {
      createdAt: { lt: createdBefore },
      status: { in: ["SENT", "FAILED"] },
    },
  });

  return result.count;
};
