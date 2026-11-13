import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import type { Express } from "express";
import request from "supertest";
import { createApp } from "../src/app";
import { EMAIL_LOGO_CID } from "../src/utils/email-template";
import type { OutgoingMail } from "../src/utils/mailer";
import { setMailSenderForTesting } from "../src/utils/mailer";
import { hashToken } from "../src/utils/token";
import {
  createMockDatabase,
  createPasswordResetTokenFixture,
  TEST_ADMIN_PASSWORD,
  TEST_CHANGED_PASSWORD,
  TEST_PARTNER_PASSWORD,
} from "./helpers/mock-database";
import type { MockDatabase } from "./helpers/mock-database";
import { flushBackgroundTasks } from "./helpers/background-tasks";

const extractResetToken = (mail: OutgoingMail): string => {
  // The token must travel in the URL fragment so it never reaches server
  // logs, proxies or Referer headers.
  const match = /#token=([0-9a-f]+)/.exec(mail.text);
  assert.ok(match);
  return match[1] as string;
};

// The forgot-password email limiter allows 5 requests per email in 15 minutes
// and its in-memory store is shared by every test in this file. The tests below
// stay within that per-email budget; the limiter itself is covered in
// security.spec.ts, which runs in its own process.
describe("Password recovery HTTP integration", { concurrency: false }, () => {
  let app: Express;
  let database: MockDatabase;
  let outbox: OutgoingMail[];
  let shouldFailMailDelivery: boolean;

  beforeEach(() => {
    database = createMockDatabase();
    app = createApp();
    outbox = [];
    shouldFailMailDelivery = false;

    setMailSenderForTesting({
      sendMail: async (options: OutgoingMail): Promise<unknown> => {
        if (shouldFailMailDelivery) {
          throw new Error("SMTP unavailable");
        }

        outbox.push(options);
        return { accepted: [options.to] };
      },
    });
  });

  afterEach(() => {
    setMailSenderForTesting(null);
  });

  const login = async (email: string, password: string): Promise<string> => {
    const response = await request(app)
      .post("/api/v1/auth/login")
      .send({ email, password });

    assert.equal(response.status, 200);
    return response.body.data.token as string;
  };

  it("keeps the response generic and stores only the token hash", async () => {
    const unknownResponse = await request(app)
      .post("/api/v1/auth/forgot-password")
      .send({ email: "unknown@example.com" });
    const knownResponse = await request(app)
      .post("/api/v1/auth/forgot-password")
      .send({ email: "partner@example.com" });
    const repeatedResponse = await request(app)
      .post("/api/v1/auth/forgot-password")
      .send({ email: "partner@example.com" });

    await flushBackgroundTasks();

    assert.equal(unknownResponse.status, 200);
    assert.deepEqual(unknownResponse.body, knownResponse.body);
    assert.deepEqual(knownResponse.body, repeatedResponse.body);
    assert.equal(
      unknownResponse.body.message,
      "Si el correo está registrado, recibirás un mensaje para restablecer tu contraseña.",
    );
    assert.deepEqual(unknownResponse.body.data, {});

    // Only the registered user receives an email, and the link carries the raw
    // token that is never persisted.
    assert.equal(outbox.length, 2);
    const firstMail = outbox[0];
    const latestMail = outbox[1];
    assert.ok(firstMail);
    assert.ok(latestMail);
    assert.equal(latestMail.to, "partner@example.com");
    assert.equal(
      latestMail.subject,
      "Restablece tu contraseña - HomeKeys Liberty",
    );
    assert.equal(latestMail.text.includes("15 minutos"), true);

    const firstToken = extractResetToken(firstMail);
    const latestToken = extractResetToken(latestMail);
    assert.equal(latestToken.length, 64);
    assert.notEqual(firstToken, latestToken);

    // Branded template: embedded logo, call-to-action, plain-text fallback and
    // the security notice.
    assert.equal(latestMail.html.includes(`cid:${EMAIL_LOGO_CID}`), true);
    assert.equal(latestMail.html.includes("HOMEKEYS LIBERTY"), true);
    assert.equal(latestMail.html.includes("Restablecer mi contraseña"), true);
    assert.equal(latestMail.html.includes(latestToken), true);
    assert.equal(latestMail.html.includes("no solicitaste este cambio"), true);
    assert.equal(latestMail.attachments?.[0]?.cid, EMAIL_LOGO_CID);
    assert.equal(latestMail.text.includes(latestToken), true);
    assert.equal(latestMail.text.includes("no solicitaste este cambio"), true);

    // The recovery link must carry the token in the URL fragment, never in
    // the query string: fragments do not reach server logs or Referer headers.
    assert.equal(latestMail.text.includes(`#token=${latestToken}`), true);
    assert.equal(latestMail.html.includes(`#token=${latestToken}`), true);
    assert.equal(latestMail.text.includes("?token="), false);
    assert.equal(latestMail.html.includes("?token="), false);

    // Requesting again leaves only one pending token: the previous one is gone.
    assert.equal(database.passwordResetTokens.length, 1);
    const storedToken = database.passwordResetTokens[0];
    assert.ok(storedToken);
    assert.equal(storedToken.tokenHash, hashToken(latestToken));
    assert.notEqual(storedToken.tokenHash, latestToken);
    assert.equal(JSON.stringify(database.passwordResetTokens).includes(latestToken), false);
    assert.equal(storedToken.used, false);
  });

  it("responds without waiting for the email delivery", async () => {
    let releaseMail: () => void = () => {};
    let mailStarted = false;
    const pendingMail = new Promise<void>((resolve) => {
      releaseMail = resolve;
    });

    setMailSenderForTesting({
      sendMail: async (options: OutgoingMail): Promise<unknown> => {
        mailStarted = true;
        await pendingMail;
        return { accepted: [options.to] };
      },
    });

    let timeoutId: NodeJS.Timeout | undefined;
    const timeoutPromise = new Promise<never>((_resolve, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error("The forgot-password response waited for SMTP."));
      }, 1000);
    });

    let response: request.Response;

    try {
      response = await Promise.race([
        request(app)
          .post("/api/v1/auth/forgot-password")
          .send({ email: "admin@example.com" }),
        timeoutPromise,
      ]);
    } finally {
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }
    }

    assert.equal(response.status, 200);

    await flushBackgroundTasks();
    assert.equal(mailStarted, true);

    releaseMail();
    await flushBackgroundTasks();
  });

  it("resets the password with a valid token and closes previous sessions", async () => {
    const partnerToken = await login(
      "partner@example.com",
      TEST_PARTNER_PASSWORD,
    );

    await request(app)
      .post("/api/v1/auth/forgot-password")
      .send({ email: "partner@example.com" });
    await flushBackgroundTasks();
    const rawToken = extractResetToken(outbox[0] as OutgoingMail);

    const response = await request(app)
      .post("/api/v1/auth/reset-password")
      .send({ token: rawToken, newPassword: TEST_CHANGED_PASSWORD });

    assert.equal(response.status, 200);
    assert.equal(response.body.message, "Contraseña restablecida exitosamente.");
    assert.deepEqual(response.body.data, {});
    assert.equal(JSON.stringify(response.body).includes("passwordHash"), false);

    const staleSessionResponse = await request(app)
      .get("/api/v1/users/me")
      .set("Authorization", `Bearer ${partnerToken}`);

    assert.equal(staleSessionResponse.status, 401);
    assert.equal(staleSessionResponse.body.code, "SESSION_INVALIDATED");

    const newLoginResponse = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "partner@example.com", password: TEST_CHANGED_PASSWORD });

    assert.equal(newLoginResponse.status, 200);

    const oldLoginResponse = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "partner@example.com", password: TEST_PARTNER_PASSWORD });

    assert.equal(oldLoginResponse.status, 401);

    const reuseResponse = await request(app)
      .post("/api/v1/auth/reset-password")
      .send({ token: rawToken, newPassword: TEST_ADMIN_PASSWORD });

    assert.equal(reuseResponse.status, 400);
    assert.equal(reuseResponse.body.code, "RESET_TOKEN_ALREADY_USED");

    assert.equal(
      database.passwordResetTokens.filter(
        (token) => token.userId === 2 && !token.used,
      ).length,
      0,
    );
    const partner = database.users.find((user) => user.id === 2);
    assert.ok(partner);
    assert.equal(partner.passwordChangedAt !== null, true);
  });

  it("consumes a recovery token only once under concurrent requests", async () => {
    const rawToken = "d".repeat(64);
    database.passwordResetTokens.push(
      createPasswordResetTokenFixture(
        1,
        hashToken(rawToken),
        2,
        new Date(Date.now() + 15 * 60 * 1000),
      ),
    );

    const [firstResponse, secondResponse] = await Promise.all([
      request(app)
        .post("/api/v1/auth/reset-password")
        .send({ token: rawToken, newPassword: TEST_CHANGED_PASSWORD }),
      request(app)
        .post("/api/v1/auth/reset-password")
        .send({ token: rawToken, newPassword: TEST_ADMIN_PASSWORD }),
    ]);

    const responses = [firstResponse, secondResponse];
    const successfulResponses = responses.filter(
      (response) => response.status === 200,
    );
    const rejectedResponses = responses.filter(
      (response) => response.status === 400,
    );

    assert.equal(successfulResponses.length, 1);
    assert.equal(rejectedResponses.length, 1);
    assert.equal(
      rejectedResponses[0]?.body.code,
      "RESET_TOKEN_ALREADY_USED",
    );

    const storedToken = database.passwordResetTokens.find(
      (token) => token.tokenHash === hashToken(rawToken),
    );
    assert.ok(storedToken);
    assert.equal(storedToken.used, true);
  });

  it("rejects expired tokens, unknown tokens and weak new passwords", async () => {
    const expiredRawToken = "a".repeat(64);
    const validRawToken = "b".repeat(64);
    database.passwordResetTokens.push(
      createPasswordResetTokenFixture(
        1,
        hashToken(expiredRawToken),
        2,
        new Date(Date.now() - 60 * 1000),
      ),
      createPasswordResetTokenFixture(
        2,
        hashToken(validRawToken),
        2,
        new Date(Date.now() + 15 * 60 * 1000),
      ),
    );
    const partner = database.users.find((user) => user.id === 2);
    assert.ok(partner);
    const passwordHashBefore = partner.passwordHash;

    const expiredResponse = await request(app)
      .post("/api/v1/auth/reset-password")
      .send({ token: expiredRawToken, newPassword: TEST_CHANGED_PASSWORD });

    assert.equal(expiredResponse.status, 400);
    assert.equal(expiredResponse.body.code, "RESET_TOKEN_EXPIRED");

    const unknownResponse = await request(app)
      .post("/api/v1/auth/reset-password")
      .send({ token: "c".repeat(64), newPassword: TEST_CHANGED_PASSWORD });

    assert.equal(unknownResponse.status, 400);
    assert.equal(unknownResponse.body.code, "INVALID_RESET_TOKEN");

    const weakResponse = await request(app)
      .post("/api/v1/auth/reset-password")
      .send({ token: validRawToken, newPassword: "abcdefgh1!" });

    assert.equal(weakResponse.status, 400);
    assert.equal(weakResponse.body.code, "VALIDATION_ERROR");
    assert.equal(
      weakResponse.body.errors.some(
        (error: { field: string }) => error.field === "newPassword",
      ),
      true,
    );

    assert.equal(partner.passwordHash, passwordHashBefore);

    const strictBodyResponse = await request(app)
      .post("/api/v1/auth/reset-password")
      .send({
        token: validRawToken,
        newPassword: TEST_CHANGED_PASSWORD,
        extra: "value",
      });

    assert.equal(strictBodyResponse.status, 400);
    assert.equal(strictBodyResponse.body.code, "VALIDATION_ERROR");
  });

  it("answers generically even when the email cannot be delivered", async () => {
    shouldFailMailDelivery = true;

    const response = await request(app)
      .post("/api/v1/auth/forgot-password")
      .send({ email: "partner@example.com" });

    await flushBackgroundTasks();

    assert.equal(response.status, 200);
    assert.equal(
      response.body.message,
      "Si el correo está registrado, recibirás un mensaje para restablecer tu contraseña.",
    );
    assert.equal(outbox.length, 0);
    assert.equal(database.passwordResetTokens.length, 1);
  });
});
