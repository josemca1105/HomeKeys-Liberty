import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createPersonNameSchema,
  phoneSchema,
} from "../src/validators/common-schemas";

const nameSchema = createPersonNameSchema("nombre");

const assertAccepted = (
  schema: typeof phoneSchema | typeof nameSchema,
  value: string,
): void => {
  assert.equal(schema.safeParse(value).success, true, `Expected "${value}"`);
};

const assertRejected = (
  schema: typeof phoneSchema | typeof nameSchema,
  value: string,
): void => {
  assert.equal(schema.safeParse(value).success, false, `Rejected "${value}"`);
};

describe("Phone validation", () => {
  it("accepts local and international formats", () => {
    assertAccepted(phoneSchema, "00000000");
    assertAccepted(phoneSchema, "04121234567");
    assertAccepted(phoneSchema, "+58 412-123 4567");
    assertAccepted(phoneSchema, "(0212) 555.1234");
  });

  it("trims surrounding whitespace", () => {
    const result = phoneSchema.safeParse("  04121234567  ");
    assert.equal(result.success, true);

    if (result.success) {
      assert.equal(result.data, "04121234567");
    }
  });

  it("rejects letters and symbols outside the allowed set", () => {
    assertRejected(phoneSchema, "abc12345");
    assertRejected(phoneSchema, "0412/1234567");
    assertRejected(phoneSchema, "0412#1234567");
  });

  it("rejects too few or too many digits", () => {
    assertRejected(phoneSchema, "12345");
    assertRejected(phoneSchema, "1234567890123456");
  });

  it("rejects control characters", () => {
    assertRejected(phoneSchema, "0412\u00001234567");
  });
});

describe("Person name validation", () => {
  it("accepts names with accents, apostrophes, hyphens and spaces", () => {
    assertAccepted(nameSchema, "María");
    assertAccepted(nameSchema, "O'Brien");
    assertAccepted(nameSchema, "Van der Berg");
    assertAccepted(nameSchema, "José-María");
    assertAccepted(nameSchema, "Ñáñez");
  });

  it("trims surrounding whitespace", () => {
    const result = nameSchema.safeParse("  Ana  ");
    assert.equal(result.success, true);

    if (result.success) {
      assert.equal(result.data, "Ana");
    }
  });

  it("rejects names without letters", () => {
    assertRejected(nameSchema, "12345");
    assertRejected(nameSchema, "---");
    assertRejected(nameSchema, "''");
  });

  it("rejects control characters", () => {
    assertRejected(nameSchema, "Ana\u0000");
    assertRejected(nameSchema, "Ana\u0007María");
  });
});
