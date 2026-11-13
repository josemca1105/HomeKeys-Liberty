import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import express, { type Express } from "express";
import request from "supertest";
import { createApp } from "../src/app";
import { noStore } from "../src/middleware/no-store";
import type { OutgoingMail } from "../src/utils/mailer";
import { setMailSenderForTesting } from "../src/utils/mailer";
import {
  createMockDatabase,
  TEST_ADMIN_PASSWORD,
} from "./helpers/mock-database";

const assertNoStoreHeaders = (response: request.Response): void => {
  assert.equal(response.headers["cache-control"], "no-store, private");
  assert.equal(response.headers["pragma"], "no-cache");
  assert.equal(response.headers["expires"], "0");
};

describe("Cache-Control middleware", () => {
  describe("unit", () => {
    let app: Express;

    beforeEach(() => {
      app = express();
      app.use(noStore);
      app.get("/probe", (_req, res) => {
        res.status(200).json({ ok: true });
      });
    });

    it("sets no-store, private, Pragma and Expires on responses", async () => {
      const response = await request(app).get("/probe");

      assert.equal(response.status, 200);
      assertNoStoreHeaders(response);
    });
  });

  describe("HTTP integration", { concurrency: false }, () => {
    let app: Express;

    beforeEach(() => {
      createMockDatabase();
      app = createApp();

      setMailSenderForTesting({
        sendMail: async (options: OutgoingMail): Promise<unknown> => {
          return { accepted: [options.to] };
        },
      });
    });

    afterEach(() => {
      setMailSenderForTesting(null);
    });

    it("prevents caching of login failures", async () => {
      const response = await request(app)
        .post("/api/v1/auth/login")
        .send({ email: "unknown@example.com", password: "Wrong-Password1!" });

      assert.equal(response.status, 401);
      assertNoStoreHeaders(response);
    });

    it("prevents caching of login successes, which return tokens", async () => {
      const response = await request(app)
        .post("/api/v1/auth/login")
        .send({
          email: "admin@example.com",
          password: TEST_ADMIN_PASSWORD,
        });

      assert.equal(response.status, 200);
      assertNoStoreHeaders(response);
    });

    it("prevents caching of authenticated user data", async () => {
      const loginResponse = await request(app)
        .post("/api/v1/auth/login")
        .send({
          email: "admin@example.com",
          password: TEST_ADMIN_PASSWORD,
        });

      const token = loginResponse.body.data.token as string;

      const response = await request(app)
        .get("/api/v1/users/me")
        .set("Authorization", `Bearer ${token}`);

      assert.equal(response.status, 200);
      assertNoStoreHeaders(response);
    });

    it("prevents caching of forgot-password responses", async () => {
      const response = await request(app)
        .post("/api/v1/auth/forgot-password")
        .send({ email: "unknown@example.com" });

      assert.equal(response.status, 200);
      assertNoStoreHeaders(response);
    });

    it("prevents caching of audit log responses", async () => {
      const loginResponse = await request(app)
        .post("/api/v1/auth/login")
        .send({
          email: "admin@example.com",
          password: TEST_ADMIN_PASSWORD,
        });

      const token = loginResponse.body.data.token as string;

      const response = await request(app)
        .get("/api/v1/audit-logs")
        .set("Authorization", `Bearer ${token}`);

      assert.equal(response.status, 200);
      assertNoStoreHeaders(response);
    });

    it("prevents caching of unknown API routes too", async () => {
      const response = await request(app).get("/api/v1/does-not-exist");

      assert.equal(response.status, 404);
      assertNoStoreHeaders(response);
    });
  });
});
