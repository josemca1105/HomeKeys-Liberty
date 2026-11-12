import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  JWT_SECRET_MIN_LENGTH,
  jwtSecretSchema,
} from "../src/config/jwt-secret";

const VALID_SECRET = "0123456789abcdef".repeat(4);

describe("JWT secret configuration", () => {
  it("accepts a secret with enough length and character diversity", () => {
    assert.equal(VALID_SECRET.length, JWT_SECRET_MIN_LENGTH);
    assert.equal(jwtSecretSchema.safeParse(VALID_SECRET).success, true);
  });

  it("rejects a secret shorter than the minimum", () => {
    const result = jwtSecretSchema.safeParse(VALID_SECRET.slice(0, -1));

    assert.equal(result.success, false);
  });

  it("rejects a low-diversity secret", () => {
    const result = jwtSecretSchema.safeParse("a".repeat(JWT_SECRET_MIN_LENGTH));

    assert.equal(result.success, false);
  });

  it("rejects the documented placeholder", () => {
    const result = jwtSecretSchema.safeParse(
      "CHANGE_ME_WITH_OPENSSL_RAND_HEX_32",
    );

    assert.equal(result.success, false);
  });

  it("rejects a placeholder that satisfies length and diversity", () => {
    const placeholder = `REPLACE_WITH_${"0123456789abcdef".repeat(4)}`;

    assert.equal(placeholder.length >= JWT_SECRET_MIN_LENGTH, true);
    assert.equal(jwtSecretSchema.safeParse(placeholder).success, false);
  });

  it("rejects development-style placeholders", () => {
    const placeholder = `DEV_SECRET_${"0123456789abcdef".repeat(4)}`;

    assert.equal(placeholder.length >= JWT_SECRET_MIN_LENGTH, true);
    assert.equal(jwtSecretSchema.safeParse(placeholder).success, false);
  });

  it("rejects leading or trailing whitespace", () => {
    const result = jwtSecretSchema.safeParse(` ${VALID_SECRET} `);

    assert.equal(result.success, false);
  });
});
