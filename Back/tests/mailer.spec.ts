import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  sendPasswordResetEmail,
  setMailSenderForTesting,
} from "../src/utils/mailer";

process.env.NODE_ENV = "test";

describe("Mailer test guard", () => {
  afterEach(() => {
    setMailSenderForTesting(null);
  });

  it("refuses to use the real SMTP transport without a test sender", async () => {
    setMailSenderForTesting(null);

    await assert.rejects(
      () =>
        sendPasswordResetEmail({
          to: "user@example.com",
          firstName: "Test",
          resetUrl: "https://example.com/reset-password?token=test",
          expirationMinutes: 15,
        }),
      /Real SMTP delivery is disabled in tests/,
    );
  });
});
