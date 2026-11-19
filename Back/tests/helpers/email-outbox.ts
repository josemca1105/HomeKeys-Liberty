import { processEmailOutboxBatch } from "../../src/services/email-outbox-service";

/**
 * Delivers every due email in tests. Requests only enqueue emails now, so
 * tests that assert on the captured outbox must flush it first.
 */
export const flushEmailOutbox = async (): Promise<void> => {
  await processEmailOutboxBatch({ limit: 100 });
};
