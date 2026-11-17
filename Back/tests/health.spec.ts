import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import type { Express } from "express";
import request from "supertest";
import { createApp } from "../src/app";
import { createMockDatabase } from "./helpers/mock-database";
import type { MockDatabase } from "./helpers/mock-database";

describe("Health endpoints", { concurrency: false }, () => {
  let app: Express;
  let database: MockDatabase;

  beforeEach(() => {
    database = createMockDatabase();
    app = createApp();
  });

  it("reports liveness without authentication", async () => {
    const response = await request(app).get("/health");

    assert.equal(response.status, 200);
    assert.equal(response.body.success, true);
    assert.equal(response.body.data.status, "ok");
    assert.equal(typeof response.body.data.uptimeSeconds, "number");
  });

  it("reports readiness when the database responds", async () => {
    const response = await request(app).get("/ready");

    assert.equal(response.status, 200);
    assert.equal(response.body.success, true);
    assert.equal(response.body.data.status, "ready");
  });

  it("reports 503 when the database is unavailable", async () => {
    database.failNextDatabaseCheck();

    const response = await request(app).get("/ready");

    assert.equal(response.status, 503);
    assert.equal(response.body.success, false);
    assert.equal(response.body.code, "NOT_READY");
  });
});
