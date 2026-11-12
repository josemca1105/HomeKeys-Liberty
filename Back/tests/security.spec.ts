import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import type { Express } from "express";
import request from "supertest";
import { createApp } from "../src/app";
import { environment } from "../src/config/env";
import { cleanupExpiredRevokedTokens } from "../src/services/token-cleanup-service";
import {
  createMockDatabase,
  createRevokedTokenFixture,
  TEST_ADMIN_PASSWORD,
  TEST_CHANGED_PASSWORD,
} from "./helpers/mock-database";
import type { MockDatabase } from "./helpers/mock-database";

describe("Security and maintenance HTTP integration", { concurrency: false }, () => {
  let app: Express;
  let database: MockDatabase;

  beforeEach(() => {
    database = createMockDatabase();
    app = createApp();
  });

  it("allows a configured CORS origin", async () => {
    const allowedOrigin = environment.CORS_ORIGINS[0];
    assert.ok(allowedOrigin);

    const response = await request(app)
      .post("/api/v1/auth/logout")
      .set("Origin", allowedOrigin);

    assert.equal(response.status, 401);
    assert.equal(response.headers["access-control-allow-origin"], allowedOrigin);
  });

  it("rejects an origin outside the CORS allowlist", async () => {
    const response = await request(app)
      .post("/api/v1/auth/logout")
      .set("Origin", "https://not-allowed.example.com");

    assert.equal(response.status, 403);
    assert.equal(response.body.code, "CORS_ORIGIN_DENIED");
  });

  it("applies the configured trust proxy setting", () => {
    assert.deepEqual(app.get("trust proxy"), environment.TRUST_PROXY);
  });

  it("rate limits repeated failed login attempts for one account", async () => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await request(app)
        .post("/api/v1/auth/login")
        .send({
          email: "unknown@example.com",
          password: "Wrong-Password1!",
        });

      assert.equal(response.status, 401);
    }

    const blockedResponse = await request(app)
      .post("/api/v1/auth/login")
      .send({
        email: "unknown@example.com",
        password: "Wrong-Password1!",
      });

    assert.equal(blockedResponse.status, 429);
    assert.equal(blockedResponse.body.code, "TOO_MANY_LOGIN_ATTEMPTS");
  });

  it("rate limits repeated password change failures", async () => {
    const loginResponse = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "admin@example.com", password: TEST_ADMIN_PASSWORD });

    assert.equal(loginResponse.status, 200);
    const adminToken = loginResponse.body.data.token as string;

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await request(app)
        .patch("/api/v1/users/me/password")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          currentPassword: "Wrong-Password1!",
          newPassword: TEST_CHANGED_PASSWORD,
        });

      assert.equal(response.status, 401);
      assert.equal(response.body.code, "INVALID_CURRENT_PASSWORD");
    }

    const blockedResponse = await request(app)
      .patch("/api/v1/users/me/password")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        currentPassword: "Wrong-Password1!",
        newPassword: TEST_CHANGED_PASSWORD,
      });

    assert.equal(blockedResponse.status, 429);
    assert.equal(
      blockedResponse.body.code,
      "TOO_MANY_PASSWORD_CHANGE_ATTEMPTS",
    );
  });

  it("rate limits password recovery requests", async () => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await request(app)
        .post("/api/v1/auth/forgot-password")
        .send({ email: "unknown@example.com" });

      assert.equal(response.status, 200);
    }

    const blockedResponse = await request(app)
      .post("/api/v1/auth/forgot-password")
      .send({ email: "unknown@example.com" });

    assert.equal(blockedResponse.status, 429);
    assert.equal(blockedResponse.body.code, "TOO_MANY_RESET_ATTEMPTS");
  });

  it("deletes only expired revoked tokens", async () => {
    database.revokedTokens.push(
      createRevokedTokenFixture(
        1,
        "expired-token",
        new Date("2026-01-01T00:00:00.000Z"),
      ),
      createRevokedTokenFixture(
        2,
        "active-token",
        new Date("2026-01-03T00:00:00.000Z"),
      ),
    );

    const deletedTokens = await cleanupExpiredRevokedTokens(
      new Date("2026-01-02T00:00:00.000Z"),
    );

    assert.equal(deletedTokens, 1);
    assert.deepEqual(
      database.revokedTokens.map((token) => token.tokenHash),
      ["active-token"],
    );
  });
});
