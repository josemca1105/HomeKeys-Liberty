import { EmailType } from "@prisma/client";
import type { EmailOutbox, Prisma } from "@prisma/client";
import { z } from "zod";
import {
  claimEmail,
  deleteOldEmails,
  enqueueEmail,
  findPendingEmails,
  markEmailFailed,
  markEmailSent,
  releaseStaleSendingEmails,
} from "../repositories/email-outbox-repository";
import {
  sendAccountStatusNoticeEmail,
  sendEmailChangeNoticeEmail,
  sendInvitationEmail,
  sendPasswordResetEmail,
} from "../utils/mailer";

export const MAX_EMAIL_ATTEMPTS = 5;
export const EMAIL_OUTBOX_RETENTION_DAYS = 30;

const SENDING_TIMEOUT_MS = 5 * 60 * 1000;
const RETRY_BASE_MS = 60 * 1000;
const RETRY_MAX_MS = 60 * 60 * 1000;

const invitationPayloadSchema = z.object({
  firstName: z.string().min(1),
  activationUrl: z.string().url(),
  expirationHours: z.number().positive(),
});

const passwordResetPayloadSchema = z.object({
  firstName: z.string().min(1),
  resetUrl: z.string().url(),
  expirationMinutes: z.number().positive(),
});

const emailChangeNoticePayloadSchema = z.object({
  firstName: z.string().min(1),
  loginUrl: z.string().url(),
});

const accountStatusNoticePayloadSchema = z.object({
  firstName: z.string().min(1),
  isActive: z.boolean(),
  loginUrl: z.string().url(),
});

export type InvitationEmailPayload = z.infer<typeof invitationPayloadSchema>;
export type PasswordResetEmailPayload = z.infer<
  typeof passwordResetPayloadSchema
>;
export type EmailChangeNoticePayload = z.infer<
  typeof emailChangeNoticePayloadSchema
>;
export type AccountStatusNoticePayload = z.infer<
  typeof accountStatusNoticePayloadSchema
>;

export type QueueEmailInput = {
  to: string;
  maxAttempts?: number;
  nextAttemptAt?: Date;
} & (
  | { type: typeof EmailType.INVITATION; payload: InvitationEmailPayload }
  | { type: typeof EmailType.PASSWORD_RESET; payload: PasswordResetEmailPayload }
  | {
      type: typeof EmailType.EMAIL_CHANGE_NOTICE;
      payload: EmailChangeNoticePayload;
    }
  | {
      type: typeof EmailType.ACCOUNT_STATUS_NOTICE;
      payload: AccountStatusNoticePayload;
    }
);

const parsePayload = (input: QueueEmailInput): Prisma.InputJsonValue => {
  switch (input.type) {
    case EmailType.INVITATION:
      return invitationPayloadSchema.parse(input.payload);
    case EmailType.PASSWORD_RESET:
      return passwordResetPayloadSchema.parse(input.payload);
    case EmailType.EMAIL_CHANGE_NOTICE:
      return emailChangeNoticePayloadSchema.parse(input.payload);
    case EmailType.ACCOUNT_STATUS_NOTICE:
      return accountStatusNoticePayloadSchema.parse(input.payload);
  }
};

/**
 * Queues an email for durable delivery. Call it inside the transaction that
 * owns the business change when possible, so the email and the change commit
 * or roll back together.
 */
export const queueEmail = async (
  input: QueueEmailInput,
  client?: Prisma.TransactionClient,
): Promise<void> => {
  const payload = parsePayload(input);

  await enqueueEmail(
    {
      type: input.type,
      to: input.to,
      payload,
      maxAttempts: input.maxAttempts ?? MAX_EMAIL_ATTEMPTS,
      ...(input.nextAttemptAt !== undefined
        ? { nextAttemptAt: input.nextAttemptAt }
        : {}),
    },
    client,
  );
};

const deliverEmail = async (email: EmailOutbox): Promise<void> => {
  switch (email.type) {
    case EmailType.INVITATION: {
      const payload = invitationPayloadSchema.parse(email.payload);
      await sendInvitationEmail({ to: email.to, ...payload });
      return;
    }
    case EmailType.PASSWORD_RESET: {
      const payload = passwordResetPayloadSchema.parse(email.payload);
      await sendPasswordResetEmail({ to: email.to, ...payload });
      return;
    }
    case EmailType.EMAIL_CHANGE_NOTICE: {
      const payload = emailChangeNoticePayloadSchema.parse(email.payload);
      await sendEmailChangeNoticeEmail({ to: email.to, ...payload });
      return;
    }
    case EmailType.ACCOUNT_STATUS_NOTICE: {
      const payload = accountStatusNoticePayloadSchema.parse(email.payload);
      await sendAccountStatusNoticeEmail({ to: email.to, ...payload });
      return;
    }
    default: {
      throw new Error(`Unsupported email type: ${String(email.type)}`);
    }
  }
};

export interface ProcessEmailOutboxOptions {
  limit?: number;
  now?: Date;
}

export interface ProcessEmailOutboxResult {
  processed: number;
  sent: number;
  failed: number;
}

/**
 * Claims due emails and attempts delivery. A claim prevents two workers from
 * sending the same row; stale claims are released after five minutes. Failures
 * use exponential backoff and become FAILED after `maxAttempts`.
 */
export const processEmailOutboxBatch = async ({
  limit = 10,
  now = new Date(),
}: ProcessEmailOutboxOptions = {}): Promise<ProcessEmailOutboxResult> => {
  await releaseStaleSendingEmails(
    new Date(now.getTime() - SENDING_TIMEOUT_MS),
  );

  const pendingEmails = await findPendingEmails(now, limit);
  let sent = 0;
  let failed = 0;

  for (const email of pendingEmails) {
    const claimed = await claimEmail(email.id, now);

    if (!claimed) {
      continue;
    }

    try {
      await deliverEmail(email);
      await markEmailSent(email.id, new Date());
      sent += 1;
    } catch (error) {
      const attempts = email.attempts + 1;
      const retryDelay = Math.min(
        RETRY_BASE_MS * 2 ** (attempts - 1),
        RETRY_MAX_MS,
      );
      const message = error instanceof Error ? error.message : String(error);

      await markEmailFailed(email.id, {
        attempts,
        maxAttempts: email.maxAttempts,
        nextAttemptAt: new Date(now.getTime() + retryDelay),
        error: message,
      });

      console.error("Failed to deliver queued email.", {
        id: email.id,
        type: email.type,
        attempts,
        message,
      });
      failed += 1;
    }
  }

  return {
    processed: pendingEmails.length,
    sent,
    failed,
  };
};

export const cleanupOldEmails = async (
  createdBefore = new Date(
    Date.now() - EMAIL_OUTBOX_RETENTION_DAYS * 24 * 60 * 60 * 1000,
  ),
): Promise<number> => {
  return deleteOldEmails(createdBefore);
};
