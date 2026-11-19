import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { EmailType } from "@prisma/client";
import type { Express } from "express";
import request from "supertest";
import { createApp } from "../src/app";
import {
  cleanupOldEmails,
  processEmailOutboxBatch,
  queueEmail,
} from "../src/services/email-outbox-service";
import type { OutgoingMail } from "../src/utils/mailer";
import { setMailSenderForTesting } from "../src/utils/mailer";
import {
  createMockDatabase,
  TEST_ADMIN_PASSWORD,
} from "./helpers/mock-database";
import type { MockDatabase } from "./helpers/mock-database";

const INVITATION_PAYLOAD = {
  firstName: "Queued",
  activationUrl: "https://example.com/reset#token=abc",
  expirationHours: 24,
};

describe("Email outbox", { concurrency: false }, () => {
  let app: Express;
  let database: MockDatabase;
  let outbox: OutgoingMail[];

  beforeEach(() => {
    database = createMockDatabase();
    app = createApp();
    outbox = [];

    setMailSenderForTesting({
      sendMail: async (options: OutgoingMail): Promise<unknown> => {
        outbox.push(options);
        return { accepted: [options.to] };
      },
    });
  });

  afterEach(() => {
    setMailSenderForTesting(null);
  });

  it("queues the invitation in the user transaction and delivers it in a batch", async () => {
    const loginResponse = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "admin@example.com", password: TEST_ADMIN_PASSWORD });
    const adminToken = loginResponse.body.data.token as string;

    const createResponse = await request(app)
      .post("/api/v1/users/add")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        firstName: "Queued",
        lastName: "User",
        email: "queued-user@example.com",
        phone: "00000000",
        photoUrl: null,
      });

    assert.equal(createResponse.status, 201);
    assert.equal(createResponse.body.data.invitationSent, true);
    assert.equal(database.emailOutbox.length, 1);
    assert.equal(database.emailOutbox[0]?.type, EmailType.INVITATION);
    assert.equal(database.emailOutbox[0]?.status, "PENDING");
    assert.equal(outbox.length, 0);

    const result = await processEmailOutboxBatch();

    assert.deepEqual(result, { processed: 1, sent: 1, failed: 0 });
    assert.equal(outbox.length, 1);
    assert.equal(outbox[0]?.to, "queued-user@example.com");
    assert.equal(
      database.emailOutbox[0]?.status,
      "SENT",
    );
    assert.equal(database.emailOutbox[0]?.sentAt instanceof Date, true);
  });

  it("retries with backoff and marks the email FAILED after maxAttempts", async () => {
    setMailSenderForTesting({
      sendMail: async (): Promise<unknown> => {
        throw new Error("SMTP unavailable");
      },
    });

    await queueEmail({
      type: EmailType.INVITATION,
      to: "retry@example.com",
      maxAttempts: 2,
      payload: INVITATION_PAYLOAD,
    });

    const firstAttemptAt = new Date();
    await processEmailOutboxBatch({ now: firstAttemptAt });

    const afterFirst = database.emailOutbox[0];
    assert.ok(afterFirst);
    assert.equal(afterFirst.status, "PENDING");
    assert.equal(afterFirst.attempts, 1);
    assert.equal(
      afterFirst.nextAttemptAt.getTime() > firstAttemptAt.getTime(),
      true,
    );
    assert.equal(outbox.length, 0);

    const secondAttemptAt = new Date(firstAttemptAt.getTime() + 2 * 60 * 1000);
    await processEmailOutboxBatch({ now: secondAttemptAt });

    const afterSecond = database.emailOutbox[0];
    assert.ok(afterSecond);
    assert.equal(afterSecond.status, "FAILED");
    assert.equal(afterSecond.attempts, 2);
    assert.equal(afterSecond.lastError?.includes("SMTP unavailable"), true);
  });

  it("does not deliver before nextAttemptAt", async () => {
    await queueEmail({
      type: EmailType.INVITATION,
      to: "future@example.com",
      nextAttemptAt: new Date(Date.now() + 60 * 60 * 1000),
      payload: INVITATION_PAYLOAD,
    });

    const result = await processEmailOutboxBatch();

    assert.deepEqual(result, { processed: 0, sent: 0, failed: 0 });
    assert.equal(outbox.length, 0);
    assert.equal(database.emailOutbox[0]?.status, "PENDING");
  });

  it("releases stale SENDING rows and delivers them again", async () => {
    await queueEmail({
      type: EmailType.INVITATION,
      to: "stale@example.com",
      payload: INVITATION_PAYLOAD,
    });

    const staleEmail = database.emailOutbox[0];
    assert.ok(staleEmail);
    staleEmail.status = "SENDING";
    staleEmail.lockedAt = new Date(Date.now() - 10 * 60 * 1000);

    const result = await processEmailOutboxBatch();

    assert.deepEqual(result, { processed: 1, sent: 1, failed: 0 });
    assert.equal(staleEmail.status, "SENT");
    assert.equal(outbox.length, 1);
  });

  it("removes old delivered and failed emails", async () => {
    await queueEmail({
      type: EmailType.INVITATION,
      to: "old-sent@example.com",
      payload: INVITATION_PAYLOAD,
    });
    await queueEmail({
      type: EmailType.INVITATION,
      to: "old-failed@example.com",
      payload: INVITATION_PAYLOAD,
    });

    const oldDate = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000);
    const sentEmail = database.emailOutbox[0];
    const failedEmail = database.emailOutbox[1];
    assert.ok(sentEmail);
    assert.ok(failedEmail);
    sentEmail.status = "SENT";
    sentEmail.createdAt = oldDate;
    failedEmail.status = "FAILED";
    failedEmail.createdAt = oldDate;

    const deleted = await cleanupOldEmails();

    assert.equal(deleted, 2);
    assert.equal(database.emailOutbox.length, 0);
  });
});
