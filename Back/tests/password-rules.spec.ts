import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isCommonPassword,
  normalizePasswordCandidate,
} from "../src/utils/password-blocklist";
import { isPasswordBasedOnIdentity } from "../src/utils/password-identity";

describe("Password normalization", () => {
  it("removes case, accents and separators", () => {
    assert.equal(
      normalizePasswordCandidate("Ñandú#2026x"),
      "nandu2026x",
    );
    assert.equal(
      normalizePasswordCandidate("Maria.Gonzalez@Example.com"),
      "mariagonzalezexamplecom",
    );
  });
});

describe("Common password blocklist", () => {
  it("rejects common passwords regardless of case and separators", () => {
    assert.equal(isCommonPassword("Password1234!"), true);
    assert.equal(isCommonPassword("p@ssword-1234"), true);
    assert.equal(isCommonPassword("QWERTYUIOP1234"), true);
  });

  it("rejects common base words padded only with digits", () => {
    assert.equal(isCommonPassword("Admin20262026!"), true);
    assert.equal(isCommonPassword("Homekeys2026!"), true);
    assert.equal(isCommonPassword("Venezuela2026!"), true);
  });

  it("rejects product-specific passwords", () => {
    assert.equal(isCommonPassword("HomeKeysLiberty"), true);
    assert.equal(isCommonPassword("homekeys_liberty_2026"), true);
  });

  it("accepts long passwords that merely contain a common word", () => {
    assert.equal(isCommonPassword("Zafiro#2026Azul"), false);
    assert.equal(isCommonPassword("Admin-Cobalt-Tango-2026"), false);
  });
});

describe("Identity-based password rule", () => {
  const identity = {
    email: "maria.gonzalez@example.com",
    firstName: "María",
    lastName: "González",
  };

  it("rejects the email and its local part", () => {
    assert.equal(
      isPasswordBasedOnIdentity("maria.gonzalez@example.com", identity),
      true,
    );
    assert.equal(isPasswordBasedOnIdentity("Maria.Gonzalez", identity), true);
  });

  it("rejects the first name, the last name and the full name", () => {
    assert.equal(isPasswordBasedOnIdentity("María", identity), true);
    assert.equal(isPasswordBasedOnIdentity("González", identity), true);
    assert.equal(isPasswordBasedOnIdentity("MariaGonzalez", identity), true);
    assert.equal(isPasswordBasedOnIdentity("GonzalezMaria", identity), true);
  });

  it("rejects the identity followed only by digits", () => {
    assert.equal(
      isPasswordBasedOnIdentity("MariaGonzalez2026!", identity),
      true,
    );
    assert.equal(isPasswordBasedOnIdentity("Maria2026!", identity), true);
  });

  it("accepts strong passwords that merely contain an identity fragment", () => {
    assert.equal(
      isPasswordBasedOnIdentity("Zafiro2026Maria", identity),
      false,
    );
    assert.equal(isPasswordBasedOnIdentity("Maria#Zafiro2026", identity), false);
  });

  it("ignores identity fragments shorter than three characters", () => {
    assert.equal(
      isPasswordBasedOnIdentity("Al20262026!", {
        firstName: "Al",
      }),
      false,
    );
  });
});
