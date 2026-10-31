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

  it("rate limits repeated failed login attempts", async () => {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const response = await request(app)
        .post("/api/v1/auth/login")
        .send({
          email: `unknown-${attempt}@example.com`,
          password: "Wrong-Password1!",
        });

      assert.equal(response.status, 401);
    }

    const blockedResponse = await request(app)
      .post("/api/v1/auth/login")
      .send({
        email: "unknown-blocked@example.com",
        password: "Wrong-Password1!",
      });

    assert.equal(blockedResponse.status, 429);
    assert.equal(blockedResponse.body.code, "TOO_MANY_LOGIN_ATTEMPTS");
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
