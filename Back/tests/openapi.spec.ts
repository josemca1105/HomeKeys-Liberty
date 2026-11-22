import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { parse } from "yaml";

const OPENAPI_PATH = path.join(process.cwd(), "openapi.yaml");

interface OpenApiOperation {
  responses?: unknown;
}

interface OpenApiDocument {
  openapi?: unknown;
  info?: { title?: unknown; version?: unknown };
  paths?: Record<string, Record<string, OpenApiOperation | unknown>>;
  components?: Record<string, unknown>;
}

const document = parse(readFileSync(OPENAPI_PATH, "utf8")) as OpenApiDocument;

const EXPECTED_PATHS = [
  "/health",
  "/ready",
  "/api/v1/auth/login",
  "/api/v1/auth/logout",
  "/api/v1/auth/forgot-password",
  "/api/v1/auth/reset-password",
  "/api/v1/users/add",
  "/api/v1/users",
  "/api/v1/users/me",
  "/api/v1/users/me/password",
  "/api/v1/users/{id}",
  "/api/v1/users/{id}/send-password-reset",
  "/api/v1/users/{id}/resend-invitation",
  "/api/v1/audit-logs",
  "/api/v1/property-photo-batches",
  "/api/v1/property-photo-batches/{batchId}",
  "/api/v1/property-photo-batches/{batchId}/photos/upload-url",
  "/api/v1/property-photo-batches/{batchId}/photos/confirm",
  "/api/v1/property-photo-batches/{batchId}/photos/{uploadId}",
  "/api/v1/property-photo-batches/{batchId}/photos/{uploadId}/content",
  "/api/v1/properties",
  "/api/v1/properties/{id}",
  "/api/v1/properties/{id}/photos/upload-url",
  "/api/v1/properties/{id}/photos/confirm",
  "/api/v1/properties/{id}/photos/order",
  "/api/v1/properties/{id}/photos/{photoId}/cover",
  "/api/v1/properties/{id}/photos/{photoId}",
  "/api/v1/properties/{id}/photos/{photoId}/content",
  "/api/v1/property-photos/local-upload",
];

const resolvePointer = (ref: string): unknown => {
  assert.equal(ref.startsWith("#/"), true, `Unsupported external ref: ${ref}`);

  const segments = ref
    .slice(2)
    .split("/")
    .map((segment) => segment.replaceAll("~1", "/").replaceAll("~0", "~"));

  let current: unknown = document;

  for (const segment of segments) {
    assert.equal(
      current !== null && typeof current === "object",
      true,
      `Cannot resolve ref: ${ref}`,
    );
    assert.equal(
      Object.prototype.hasOwnProperty.call(current, segment),
      true,
      `Broken ref: ${ref}`,
    );
    current = (current as Record<string, unknown>)[segment];
  }

  return current;
};

const collectRefs = (value: unknown, refs: string[]): void => {
  if (Array.isArray(value)) {
    for (const item of value) {
      collectRefs(item, refs);
    }
    return;
  }

  if (value === null || typeof value !== "object") {
    return;
  }

  for (const [key, child] of Object.entries(value)) {
    if (key === "$ref" && typeof child === "string") {
      refs.push(child);
      continue;
    }

    collectRefs(child, refs);
  }
};

describe("OpenAPI contract", () => {
  it("declares a 3.x document with the bearer security scheme", () => {
    assert.equal(typeof document.openapi, "string");
    assert.equal((document.openapi as string).startsWith("3."), true);
    assert.equal(typeof document.info?.title, "string");
    assert.equal(typeof document.info?.version, "string");

    const securitySchemes = document.components?.securitySchemes as
      | Record<string, { type?: string; scheme?: string }>
      | undefined;

    assert.equal(securitySchemes?.bearerAuth?.type, "http");
    assert.equal(securitySchemes?.bearerAuth?.scheme, "bearer");
  });

  it("documents every API path and every operation has responses", () => {
    const paths = document.paths ?? {};

    for (const expectedPath of EXPECTED_PATHS) {
      assert.equal(
        Object.prototype.hasOwnProperty.call(paths, expectedPath),
        true,
        `Missing path: ${expectedPath}`,
      );
    }

    for (const [pathName, operations] of Object.entries(paths)) {
      for (const [method, operation] of Object.entries(operations)) {
        if (method === "parameters") {
          continue;
        }

        assert.equal(
          typeof (operation as OpenApiOperation).responses,
          "object",
          `${method.toUpperCase()} ${pathName} has no responses`,
        );
      }
    }
  });

  it("documents the capture and photo schemas", () => {
    const schemas = document.components?.schemas as
      | Record<string, unknown>
      | undefined;

    assert.ok(schemas);

    for (const schemaName of [
      "Property",
      "PropertyPhoto",
      "PropertyPhotoBatch",
      "PropertyPhotoUpload",
      "PhotoBatchResponse",
      "PhotoUploadResponse",
      "ConfirmBatchPhotoRequest",
      "CreatePropertyRequest",
      "UpdatePropertyRequest",
      "PhotoUploadTargetRequest",
      "ConfirmPhotoRequest",
      "ReorderPhotosRequest",
      "PropertyResponse",
      "PropertyListResponse",
      "PhotoResponse",
      "PhotoListResponse",
    ]) {
      assert.equal(
        Object.prototype.hasOwnProperty.call(schemas, schemaName),
        true,
        `Missing schema: ${schemaName}`,
      );
    }
  });

  it("resolves every internal $ref", () => {
    const refs: string[] = [];
    collectRefs(document, refs);

    assert.equal(refs.length > 0, true, "The document has no $ref entries");

    for (const ref of refs) {
      resolvePointer(ref);
    }
  });
});
