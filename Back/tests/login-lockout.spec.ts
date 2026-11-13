import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import type { Express } from "express";
import request from "supertest";
import { createApp } from "../src/app";
import {
  authenticateUser,
  LOGIN_LOCK_MINUTES,
  MAX_FAILED_LOGIN_ATTEMPTS,
} from "../src/services/auth-service";
import { cleanupStaleLoginAttempts } from "../src/services/token-cleanup-service";
import { AppError } from "../src/utils/app-error";
import {
  createMockDatabase,
  TEST_PARTNER_PASSWORD,
} from "./helpers/mock-database";
import type { MockDatabase } from "./helpers/mock-database";

const WRONG_PASSWORD = "Wrong-Password1!";

const assertRejectsWithCode = async (
  operation: Promise<unknown>,
  code: string,
): Promise<AppError> => {
  try {
    await operation;
  } catch (error) {
    assert.equal(error instanceof AppError, true);
    const appError = error as AppError;
    assert.equal(appError.code, code);
    return appError;
  }

  assert.fail(`Expected the operation to reject with ${code}.`);
};

const failLoginTimes = async (email: string, times: number): Promise<void> => {
  for (let attempt = 0; attempt < times; attempt += 1) {
    await assertRejectsWithCode(
      authenticateUser({ email, password: WRONG_PASSWORD }),
      "INVALID_CREDENTIALS",
    );
  }
};

describe("Persistent login lockout", { concurrency: false }, () => {
  let database: MockDatabase;

  beforeEach(() => {
    database = createMockDatabase();
  });

  it("locks the email after the configured failures and blocks the correct password", async () => {
    const email = "partner@example.com";

    await failLoginTimes(email, MAX_FAILED_LOGIN_ATTEMPTS - 1);

    const afterFourAttempts = database.loginAttempts[0];
    assert.ok(afterFourAttempts);
    assert.equal(afterFourAttempts.failedAttempts, MAX_FAILED_LOGIN_ATTEMPTS - 1);
    assert.equal(afterFourAttempts.lockedUntil, null);

    await failLoginTimes(email, 1);

    const lockedAttempt = database.loginAttempts[0];
    assert.ok(lockedAttempt);
    assert.equal(lockedAttempt.failedAttempts, 0);
    assert.ok(lockedAttempt.lockedUntil);
    const lockDurationMs =
      lockedAttempt.lockedUntil.getTime() - Date.now();
    assert.equal(
      lockDurationMs > (LOGIN_LOCK_MINUTES - 1) * 60 * 1000,
      true,
    );
    assert.equal(lockDurationMs <= LOGIN_LOCK_MINUTES * 60 * 1000, true);

    const error = await assertRejectsWithCode(
      authenticateUser({ email, password: TEST_PARTNER_PASSWORD }),
      "ACCOUNT_LOCKED",
    );
    assert.equal(error.statusCode, 429);
  });

  it("locks unknown emails identically so existence cannot be discovered", async () => {
    const unknownEmail = "missing@example.com";

    await failLoginTimes(unknownEmail, MAX_FAILED_LOGIN_ATTEMPTS);

    const attempt = database.loginAttempts[0];
    assert.ok(attempt);
    assert.ok(attempt.lockedUntil);

    await assertRejectsWithCode(
      authenticateUser({ email: unknownEmail, password: WRONG_PASSWORD }),
      "ACCOUNT_LOCKED",
    );
  });

  it("clears the counter after a successful login", async () => {
    const email = "partner@example.com";
    await failLoginTimes(email, MAX_FAILED_LOGIN_ATTEMPTS - 1);

    const result = await authenticateUser({
      email,
      password: TEST_PARTNER_PASSWORD,
    });

    assert.equal(result.user.email, email);
    assert.equal(database.loginAttempts.length, 0);
  });

  it("allows login after the lock expires and starts a fresh window", async () => {
    const email = "partner@example.com";
    await failLoginTimes(email, MAX_FAILED_LOGIN_ATTEMPTS);

    const lockedAttempt = database.loginAttempts[0];
    assert.ok(lockedAttempt);
    lockedAttempt.lockedUntil = new Date(Date.now() - 1000);

    const result = await authenticateUser({
      email,
      password: TEST_PARTNER_PASSWORD,
    });
    assert.equal(result.user.email, email);
    assert.equal(database.loginAttempts.length, 0);

    await failLoginTimes(email, 1);
    const freshAttempt = database.loginAttempts[0];
    assert.ok(freshAttempt);
    assert.equal(freshAttempt.failedAttempts, 1);
    assert.equal(freshAttempt.lockedUntil, null);
  });

  it("exposes ACCOUNT_LOCKED through HTTP and records the audit event", async () => {
    const email = "partner@example.com";
    await failLoginTimes(email, MAX_FAILED_LOGIN_ATTEMPTS);

    const app: Express = createApp();
    const response = await request(app)
      .post("/api/v1/auth/login")
      .send({ email, password: TEST_PARTNER_PASSWORD });

    assert.equal(response.status, 429);
    assert.equal(response.body.code, "ACCOUNT_LOCKED");
    assert.equal(
      database.auditLogs.some((log) => log.action === "ACCOUNT_LOCKED"),
      true,
    );
  });

  it("persists the lock through the HTTP login endpoint", async () => {
    const app: Express = createApp();
    const email = "http-lock@example.com";

    for (let attempt = 0; attempt < MAX_FAILED_LOGIN_ATTEMPTS; attempt += 1) {
      const response = await request(app)
        .post("/api/v1/auth/login")
        .send({ email, password: WRONG_PASSWORD });

      assert.equal(response.status, 401);
    }

    const attempt = database.loginAttempts[0];
    assert.ok(attempt);
    assert.ok(attempt.lockedUntil);

    const blockedResponse = await request(app)
      .post("/api/v1/auth/login")
      .send({ email, password: WRONG_PASSWORD });

    assert.equal(blockedResponse.status, 429);
  });

  it("removes login attempts that have not changed for a day", async () => {
    await failLoginTimes("stale@example.com", 1);
    await failLoginTimes("fresh@example.com", 1);

    const staleAttempt = database.loginAttempts.find(
      (attempt) => attempt.email === "stale@example.com",
    );
    assert.ok(staleAttempt);
    staleAttempt.updatedAt = new Date(Date.now() - 25 * 60 * 60 * 1000);

    const deleted = await cleanupStaleLoginAttempts();
    assert.equal(deleted, 1);
    assert.equal(
      database.loginAttempts.some(
        (attempt) => attempt.email === "stale@example.com",
      ),
      false,
    );
    assert.equal(
      database.loginAttempts.some(
        (attempt) => attempt.email === "fresh@example.com",
      ),
      true,
    );
  });
});
