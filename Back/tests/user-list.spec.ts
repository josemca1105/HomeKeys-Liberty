import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { Role } from "@prisma/client";
import type { Express } from "express";
import request from "supertest";
import { createApp } from "../src/app";
import {
  createMockDatabase,
  TEST_ADMIN_PASSWORD,
} from "./helpers/mock-database";
import type { MockDatabase } from "./helpers/mock-database";

describe("User list pagination HTTP integration", { concurrency: false }, () => {
  let app: Express;
  let database: MockDatabase;

  beforeEach(() => {
    database = createMockDatabase();
    app = createApp();

    const ana = database.addUser({
      id: 3,
      email: "ana@example.com",
      role: Role.PARTNER,
      password: TEST_ADMIN_PASSWORD,
    });
    ana.firstName = "Ana";
    ana.lastName = "Zapata";
    ana.createdAt = new Date("2026-01-03T00:00:00.000Z");

    const beto = database.addUser({
      id: 4,
      email: "beto@example.com",
      role: Role.PARTNER,
      password: TEST_ADMIN_PASSWORD,
    });
    beto.firstName = "Beto";
    beto.lastName = "Alvarez";
    beto.createdAt = new Date("2026-01-04T00:00:00.000Z");
  });

  const login = async (email: string, password: string): Promise<string> => {
    const response = await request(app)
      .post("/api/v1/auth/login")
      .send({ email, password });

    assert.equal(response.status, 200);
    return response.body.data.token as string;
  };

  it("returns the first page with pagination metadata", async () => {
    const adminToken = await login("admin@example.com", TEST_ADMIN_PASSWORD);

    const response = await request(app)
      .get("/api/v1/users")
      .set("Authorization", `Bearer ${adminToken}`);

    assert.equal(response.status, 200);
    assert.equal(response.body.data.users.length, 4);
    assert.deepEqual(response.body.data.pagination, {
      page: 1,
      pageSize: 20,
      total: 4,
      totalPages: 1,
    });
  });

  it("respects page and pageSize", async () => {
    const adminToken = await login("admin@example.com", TEST_ADMIN_PASSWORD);

    const firstPage = await request(app)
      .get("/api/v1/users?page=1&pageSize=2")
      .set("Authorization", `Bearer ${adminToken}`);

    assert.equal(firstPage.status, 200);
    assert.equal(firstPage.body.data.users.length, 2);
    assert.equal(firstPage.body.data.users[0].firstName, "Beto");
    assert.equal(firstPage.body.data.users[1].firstName, "Ana");
    assert.deepEqual(firstPage.body.data.pagination, {
      page: 1,
      pageSize: 2,
      total: 4,
      totalPages: 2,
    });

    const secondPage = await request(app)
      .get("/api/v1/users?page=2&pageSize=2")
      .set("Authorization", `Bearer ${adminToken}`);

    assert.equal(secondPage.status, 200);
    assert.equal(secondPage.body.data.users.length, 2);
    assert.equal(secondPage.body.data.pagination.page, 2);
  });

  it("returns an empty page when the page is beyond the last one", async () => {
    const adminToken = await login("admin@example.com", TEST_ADMIN_PASSWORD);

    const response = await request(app)
      .get("/api/v1/users?page=3&pageSize=2")
      .set("Authorization", `Bearer ${adminToken}`);

    assert.equal(response.status, 200);
    assert.deepEqual(response.body.data.users, []);
    assert.equal(response.body.data.pagination.total, 4);
    assert.equal(response.body.data.pagination.totalPages, 2);
  });

  it("filters by role", async () => {
    const adminToken = await login("admin@example.com", TEST_ADMIN_PASSWORD);

    const response = await request(app)
      .get("/api/v1/users?role=ADMIN")
      .set("Authorization", `Bearer ${adminToken}`);

    assert.equal(response.status, 200);
    assert.equal(response.body.data.users.length, 1);
    assert.equal(response.body.data.users[0].email, "admin@example.com");
    assert.equal(response.body.data.pagination.total, 1);
  });

  it("searches by name or email without case sensitivity", async () => {
    const adminToken = await login("admin@example.com", TEST_ADMIN_PASSWORD);

    const response = await request(app)
      .get("/api/v1/users?search=ZAPATA")
      .set("Authorization", `Bearer ${adminToken}`);

    assert.equal(response.status, 200);
    assert.equal(response.body.data.users.length, 1);
    assert.equal(response.body.data.users[0].email, "ana@example.com");
    assert.equal(response.body.data.pagination.total, 1);
  });

  it("sorts by an allowed field and direction", async () => {
    const adminToken = await login("admin@example.com", TEST_ADMIN_PASSWORD);

    const response = await request(app)
      .get("/api/v1/users?sortBy=firstName&sortOrder=asc")
      .set("Authorization", `Bearer ${adminToken}`);

    assert.equal(response.status, 200);
    assert.equal(response.body.data.users[0].firstName, "Ana");
    assert.equal(response.body.data.users[1].firstName, "Beto");
  });

  it("validates supported query parameters", async () => {
    const adminToken = await login("admin@example.com", TEST_ADMIN_PASSWORD);

    const invalidQueries = [
      "page=0",
      "pageSize=101",
      "sortBy=password",
      "sortOrder=sideways",
      "role=SUPERADMIN",
      "unknown=value",
      "search=",
    ];

    for (const query of invalidQueries) {
      const response = await request(app)
        .get(`/api/v1/users?${query}`)
        .set("Authorization", `Bearer ${adminToken}`);

      assert.equal(response.status, 400);
      assert.equal(response.body.code, "VALIDATION_ERROR");
    }
  });
});
