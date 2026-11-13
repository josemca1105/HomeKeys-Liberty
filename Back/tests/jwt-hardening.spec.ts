import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { Role } from "@prisma/client";
import type { Express } from "express";
import jwt from "jsonwebtoken";
import request from "supertest";
import { createApp } from "../src/app";
import { environment } from "../src/config/env";
import type { OutgoingMail } from "../src/utils/mailer";
import { setMailSenderForTesting } from "../src/utils/mailer";
import { generateAuthToken, verifyAuthToken } from "../src/utils/jwt";
import { createMockDatabase } from "./helpers/mock-database";

const SECRET = environment.JWT_SECRET;
const TOKEN_ISSUER = environment.JWT_ISSUER;
const TOKEN_AUDIENCE = environment.JWT_AUDIENCE;

interface CraftOptions {
  algorithm?: jwt.Algorithm;
  issuer?: string;
  audience?: string;
  subject?: string;
  payload?: Record<string, unknown>;
}

const DEFAULT_PAYLOAD = {
  role: Role.ADMIN,
  issuedAtMs: Date.now(),
  tokenType: "access",
};

const craftToken = (options: CraftOptions = {}): string => {
  return jwt.sign(
    { ...DEFAULT_PAYLOAD, ...(options.payload ?? {}) },
    SECRET,
    {
      algorithm: options.algorithm ?? "HS256",
      issuer: options.issuer ?? TOKEN_ISSUER,
      audience: options.audience ?? TOKEN_AUDIENCE,
      subject: options.subject ?? "1",
      expiresIn: 3600,
    },
  );
};

describe("JWT hardening", () => {
  it("signs HS256 tokens that verify back with user id, role and expiry", () => {
    const token = generateAuthToken(42, Role.PARTNER);

    const header = jwt.decode(token, { complete: true })?.header;
    assert.equal(header?.alg, "HS256");

    const payload = verifyAuthToken(token);

    assert.equal(payload.userId, 42);
    assert.equal(payload.role, Role.PARTNER);
    assert.equal(payload.issuedAt.getTime() > 0, true);
    assert.equal(
      payload.expiresAt.getTime() > payload.issuedAt.getTime(),
      true,
    );
  });

  it("rejects tokens signed with a different HMAC algorithm", () => {
    assert.throws(() => verifyAuthToken(craftToken({ algorithm: "HS384" })));
    assert.throws(() => verifyAuthToken(craftToken({ algorithm: "HS512" })));
  });

  it("rejects unsigned tokens with the none algorithm", () => {
    const header = Buffer.from(
      JSON.stringify({ alg: "none", typ: "JWT" }),
    ).toString("base64url");
    const payload = Buffer.from(
      JSON.stringify({
        ...DEFAULT_PAYLOAD,
        iss: TOKEN_ISSUER,
        aud: TOKEN_AUDIENCE,
        sub: "1",
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      }),
    ).toString("base64url");
    const noneToken = `${header}.${payload}.`;

    assert.throws(() => verifyAuthToken(noneToken));
  });

  it("rejects tokens from a different issuer", () => {
    assert.throws(() =>
      verifyAuthToken(craftToken({ issuer: "attacker-issuer" })),
    );
  });

  it("rejects tokens issued for a different audience", () => {
    assert.throws(() =>
      verifyAuthToken(craftToken({ audience: "attacker-client" })),
    );
  });

  it("rejects tokens without the access tokenType claim", () => {
    const token = jwt.sign(
      {
        role: Role.ADMIN,
        issuedAtMs: Date.now(),
      },
      SECRET,
      {
        algorithm: "HS256",
        issuer: TOKEN_ISSUER,
        audience: TOKEN_AUDIENCE,
        subject: "1",
        expiresIn: 3600,
      },
    );

    assert.throws(() => verifyAuthToken(token));
  });

  it("rejects tokens of a different type", () => {
    const token = craftToken({
      payload: {
        role: Role.ADMIN,
        issuedAtMs: Date.now(),
        tokenType: "refresh",
      },
    });

    assert.throws(() => verifyAuthToken(token));
  });

  it("rejects tokens whose subject is not a numeric user id", () => {
    assert.throws(() => verifyAuthToken(craftToken({ subject: "admin" })));
    assert.throws(() =>
      verifyAuthToken(craftToken({ subject: "1.5" })),
    );
  });

  it("rejects tokens with an unknown role", () => {
    const token = craftToken({
      payload: {
        role: "SUPERADMIN",
        issuedAtMs: Date.now(),
        tokenType: "access",
      },
    });

    assert.throws(() => verifyAuthToken(token));
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

    it("rejects a correctly signed token with the wrong audience with 401", async () => {
      const forgedToken = craftToken({ audience: "attacker-client" });

      const response = await request(app)
        .get("/api/v1/users/me")
        .set("Authorization", `Bearer ${forgedToken}`);

      assert.equal(response.status, 401);
      assert.equal(response.body.code, "INVALID_SESSION");
    });

    it("rejects a token signed with a different HMAC algorithm with 401", async () => {
      const forgedToken = craftToken({ algorithm: "HS512" });

      const response = await request(app)
        .get("/api/v1/users/me")
        .set("Authorization", `Bearer ${forgedToken}`);

      assert.equal(response.status, 401);
      assert.equal(response.body.code, "INVALID_SESSION");
    });
  });
});
