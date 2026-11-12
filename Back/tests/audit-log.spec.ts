import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { AuditScope, Role } from "@prisma/client";
import type { AuditLog } from "@prisma/client";
import type { Express } from "express";
import request from "supertest";
import { createApp } from "../src/app";
import { cleanupAuditLogsByRetention } from "../src/services/audit-retention-service";
import type { OutgoingMail } from "../src/utils/mailer";
import { setMailSenderForTesting } from "../src/utils/mailer";
import {
  createMockDatabase,
  TEST_ADMIN_PASSWORD,
  TEST_PARTNER_PASSWORD,
} from "./helpers/mock-database";
import type { MockDatabase } from "./helpers/mock-database";

const buildCreateUserPayload = (
  email: string,
): Record<string, unknown> => {
  return {
    firstName: "Audit",
    lastName: "Target",
    email,
    phone: "00000000",
    photoUrl: null,
  };
};

describe("Audit log HTTP integration", { concurrency: false }, () => {
  let app: Express;
  let database: MockDatabase;

  beforeEach(() => {
    database = createMockDatabase();
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

  const login = async (email: string, password: string): Promise<string> => {
    const response = await request(app)
      .post("/api/v1/auth/login")
      .send({ email, password });

    assert.equal(response.status, 200);
    return response.body.data.token as string;
  };

  it("audits successful and failed logins", async () => {
    const adminToken = await login(
      "admin@example.com",
      TEST_ADMIN_PASSWORD,
    );

    assert.equal(typeof adminToken, "string");

    const successLog = database.auditLogs.find(
      (log) => log.action === "LOGIN_SUCCEEDED",
    );
    assert.ok(successLog);
    assert.equal(successLog.actorId, 1);
    assert.equal(successLog.actorRole, Role.ADMIN);
    assert.equal(successLog.scope, AuditScope.SECURITY);
    assert.equal(typeof successLog.requestId, "string");

    const failedResponse = await request(app)
      .post("/api/v1/auth/login")
      .send({
        email: "unknown@example.com",
        password: "Wrong-Password1!",
      });

    assert.equal(failedResponse.status, 401);

    const failedLog = database.auditLogs.find(
      (log) => log.action === "LOGIN_FAILED",
    );
    assert.ok(failedLog);
    assert.equal(failedLog.actorId, null);
    assert.equal(failedLog.actorEmail, "unknown@example.com");
    assert.equal(failedLog.scope, AuditScope.SECURITY);
  });

  it("audits user creation, updates and deletion", async () => {
    const adminToken = await login("admin@example.com", TEST_ADMIN_PASSWORD);

    const createResponse = await request(app)
      .post("/api/v1/users/add")
      .set("Authorization", `Bearer ${adminToken}`)
      .send(buildCreateUserPayload("audit-target@example.com"));

    assert.equal(createResponse.status, 201);
    const targetUserId = createResponse.body.data.user.id as number;

    const updateResponse = await request(app)
      .patch(`/api/v1/users/${targetUserId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ firstName: "Audited" });

    assert.equal(updateResponse.status, 200);

    const deleteResponse = await request(app)
      .delete(`/api/v1/users/${targetUserId}`)
      .set("Authorization", `Bearer ${adminToken}`);

    assert.equal(deleteResponse.status, 200);

    const actions = database.auditLogs.map((log) => log.action);

    assert.equal(actions.includes("USER_CREATED"), true);
    assert.equal(actions.includes("USER_UPDATED"), true);
    assert.equal(actions.includes("USER_DELETED"), true);

    const createdLog = database.auditLogs.find(
      (log) => log.action === "USER_CREATED",
    );
    assert.ok(createdLog);
    assert.equal(createdLog.actorId, 1);
    assert.equal(createdLog.entityType, "USER");
    assert.equal(createdLog.entityId, targetUserId);
  });

  it("limits a PARTNER to its own audit history", async () => {
    const adminToken = await login("admin@example.com", TEST_ADMIN_PASSWORD);

    const createResponse = await request(app)
      .post("/api/v1/users/add")
      .set("Authorization", `Bearer ${adminToken}`)
      .send(buildCreateUserPayload("audit-partner-visibility@example.com"));

    assert.equal(createResponse.status, 201);

    const partnerToken = await login(
      "partner@example.com",
      TEST_PARTNER_PASSWORD,
    );

    const partnerHistory = await request(app)
      .get("/api/v1/audit-logs?page=1&pageSize=100")
      .set("Authorization", `Bearer ${partnerToken}`);

    assert.equal(partnerHistory.status, 200);
    assert.equal(partnerHistory.body.data.logs.length > 0, true);
    assert.equal(
      partnerHistory.body.data.logs.every(
        (log: { actorId: number | null }) => log.actorId === 2,
      ),
      true,
    );

    const partnerForcedFilter = await request(app)
      .get("/api/v1/audit-logs?actorId=1")
      .set("Authorization", `Bearer ${partnerToken}`);

    assert.equal(partnerForcedFilter.status, 200);
    assert.equal(
      partnerForcedFilter.body.data.logs.every(
        (log: { actorId: number | null }) => log.actorId === 2,
      ),
      true,
    );

    const adminHistory = await request(app)
      .get("/api/v1/audit-logs?page=1&pageSize=100")
      .set("Authorization", `Bearer ${adminToken}`);

    assert.equal(adminHistory.status, 200);
    assert.equal(
      adminHistory.body.data.logs.some(
        (log: { actorId: number | null }) => log.actorId === 1,
      ),
      true,
    );
  });

  it("validates audit log query parameters", async () => {
    const adminToken = await login("admin@example.com", TEST_ADMIN_PASSWORD);

    const invalidQueries = [
      "page=0",
      "pageSize=101",
      "scope=OTHER",
      "from=not-a-date",
      "unknown=value",
    ];

    for (const query of invalidQueries) {
      const response = await request(app)
        .get(`/api/v1/audit-logs?${query}`)
        .set("Authorization", `Bearer ${adminToken}`);

      assert.equal(response.status, 400);
      assert.equal(response.body.code, "VALIDATION_ERROR");
    }
  });

  it("removes audit logs older than the retention window", async () => {
    const oldDate = new Date();
    oldDate.setMonth(oldDate.getMonth() - 25);

    const oldLog: AuditLog = {
      id: 1,
      scope: AuditScope.SECURITY,
      actorId: 1,
      actorRole: Role.ADMIN,
      actorEmail: "admin@example.com",
      action: "LOGIN_SUCCEEDED",
      entityType: "USER",
      entityId: 1,
      changes: null,
      ip: null,
      userAgent: null,
      requestId: null,
      createdAt: oldDate,
    };
    const recentLog: AuditLog = {
      ...oldLog,
      id: 2,
      createdAt: new Date(),
    };

    database.auditLogs.push(oldLog, recentLog);

    const deletedCount = await cleanupAuditLogsByRetention();

    assert.equal(deletedCount, 1);
    assert.deepEqual(
      database.auditLogs.map((log) => log.id),
      [2],
    );
  });
});
