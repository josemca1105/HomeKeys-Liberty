import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import type { Express } from "express";
import request from "supertest";
import { createApp } from "../src/app";
import type { OutgoingMail } from "../src/utils/mailer";
import { setMailSenderForTesting } from "../src/utils/mailer";
import {
  createMockDatabase,
  TEST_PARTNER_PASSWORD,
} from "./helpers/mock-database";
import type { MockDatabase } from "./helpers/mock-database";
import { flushBackgroundTasks } from "./helpers/background-tasks";

const REUSE_MESSAGE =
  "No puedes reutilizar una de tus últimas 5 contraseñas.";

const FIRST_PASSWORD = "Historial#2026Alfa";
const SECOND_PASSWORD = "Historial#2026Bravo";
const THIRD_PASSWORD = "Historial#2026Charlie";

describe("Password history HTTP integration", { concurrency: false }, () => {
  let app: Express;
  let database: MockDatabase;
  let outbox: OutgoingMail[];

  beforeEach(() => {
    database = createMockDatabase();
    app = createApp();
    outbox = [];

    setMailSenderForTesting({
      sendMail: async (options: OutgoingMail): Promise<unknown> => {
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

  const changePassword = async (
    token: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<request.Response> => {
    return request(app)
      .patch("/api/v1/users/me/password")
      .set("Authorization", `Bearer ${token}`)
      .send({ currentPassword, newPassword });
  };

  const assertReuseRejected = (response: request.Response): void => {
    assert.equal(response.status, 400);
    assert.equal(response.body.code, "VALIDATION_ERROR");
    assert.equal(
      response.body.errors.some(
        (error: { field: string; message: string }) =>
          error.field === "newPassword" && error.message === REUSE_MESSAGE,
      ),
      true,
    );
  };

  it("rejects the current and recent passwords on the own-password endpoint", async () => {
    const token = await login("partner@example.com", TEST_PARTNER_PASSWORD);

    const firstResponse = await changePassword(
      token,
      TEST_PARTNER_PASSWORD,
      FIRST_PASSWORD,
    );
    assert.equal(firstResponse.status, 200);
    const firstToken = firstResponse.body.data.token as string;

    const secondResponse = await changePassword(
      firstToken,
      FIRST_PASSWORD,
      SECOND_PASSWORD,
    );
    assert.equal(secondResponse.status, 200);
    const secondToken = secondResponse.body.data.token as string;

    assertReuseRejected(
      await changePassword(secondToken, SECOND_PASSWORD, TEST_PARTNER_PASSWORD),
    );
    assertReuseRejected(
      await changePassword(secondToken, SECOND_PASSWORD, FIRST_PASSWORD),
    );

    const freshChange = await changePassword(
      secondToken,
      SECOND_PASSWORD,
      THIRD_PASSWORD,
    );
    assert.equal(freshChange.status, 200);

    assert.equal(
      database.passwordHistory.filter((entry) => entry.userId === 2).length <= 5,
      true,
    );
  });

  it("prevents reusing a previous password through the recovery flow", async () => {
    const token = await login("partner@example.com", TEST_PARTNER_PASSWORD);

    const changeResponse = await changePassword(
      token,
      TEST_PARTNER_PASSWORD,
      FIRST_PASSWORD,
    );
    assert.equal(changeResponse.status, 200);

    const forgotResponse = await request(app)
      .post("/api/v1/auth/forgot-password")
      .send({ email: "partner@example.com" });
    assert.equal(forgotResponse.status, 200);
    await flushBackgroundTasks();

    const mail = outbox[outbox.length - 1];
    assert.ok(mail);
    const tokenMatch = /#token=([0-9a-f]{64})/.exec(mail.text);
    assert.ok(tokenMatch);

    const reuseResponse = await request(app)
      .post("/api/v1/auth/reset-password")
      .send({
        token: tokenMatch[1] as string,
        newPassword: TEST_PARTNER_PASSWORD,
      });

    assert.equal(reuseResponse.status, 400);
    assert.equal(reuseResponse.body.code, "VALIDATION_ERROR");
    assert.equal(
      reuseResponse.body.errors.some(
        (error: { message: string }) => error.message === REUSE_MESSAGE,
      ),
      true,
    );

    const freshReset = await request(app)
      .post("/api/v1/auth/reset-password")
      .send({
        token: tokenMatch[1] as string,
        newPassword: SECOND_PASSWORD,
      });

    assert.equal(freshReset.status, 200);
    assert.equal(
      typeof (await login("partner@example.com", SECOND_PASSWORD)),
      "string",
    );
  });
});
