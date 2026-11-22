import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

const COLLECTION_PATH = path.join(
  process.cwd(),
  "postman",
  "homekeys-liberty-api.postman_collection.json",
);

interface PostmanRequest {
  name?: string;
  item?: PostmanRequest[];
  request?: {
    method?: string;
    url?: string | { raw?: string };
    auth?: { type?: string };
    body?: { raw?: string };
  };
}

interface PostmanCollection {
  info?: { name?: string };
  auth?: { type?: string };
  variable?: Array<{ key?: string }>;
  item?: PostmanRequest[];
}

const collection = JSON.parse(
  readFileSync(COLLECTION_PATH, "utf8"),
) as PostmanCollection;

const findFolder = (name: string): PostmanRequest | undefined => {
  return collection.item?.find((item) => item.name === name);
};

const findRequest = (
  folderName: string,
  requestName: string,
): PostmanRequest | undefined => {
  return findFolder(folderName)?.item?.find(
    (item) => item.name === requestName,
  );
};

const parseBody = (request: PostmanRequest | undefined): Record<string, unknown> => {
  assert.ok(request?.request?.body?.raw, "Request must have a JSON body");
  return JSON.parse(request.request.body.raw) as Record<string, unknown>;
};

describe("Postman collection contract", () => {
  it("keeps the expected folders and request names", () => {
    assert.equal(collection.info?.name, "HomeKeys Liberty - API");
    assert.equal(collection.auth?.type, "bearer");

    for (const folder of [
      "Auth",
      "Users",
      "Audit",
      "Health",
      "Captaciones",
    ]) {
      assert.ok(findFolder(folder), `Missing folder: ${folder}`);
    }

    const userRequests = [
      "Get current user",
      "Get all users",
      "Get user by ID",
      "Create user",
      "Create user with ADMIN role",
      "Update user",
      "Update my profile",
      "Deactivate user",
      "Reactivate user",
      "Send password reset link",
      "Resend invitation",
      "Change my password",
      "Delete user",
    ];

    for (const requestName of userRequests) {
      assert.ok(
        findRequest("Users", requestName),
        `Missing Users request: ${requestName}`,
      );
    }

    for (const requestName of ["Login", "Forgot password", "Reset password", "Logout"]) {
      assert.ok(
        findRequest("Auth", requestName),
        `Missing Auth request: ${requestName}`,
      );
    }

    assert.ok(findRequest("Health", "Health"));
    assert.ok(findRequest("Health", "Ready"));

    for (const requestName of [
      "Create photo batch",
      "Create batch photo upload URL",
      "Confirm batch photo",
      "Get photo batch",
      "Preview batch photo",
      "Delete batch photo",
      "Create property",
      "List properties",
      "Find property by code",
      "Get property",
      "Update property",
      "Pause property",
      "Close property",
      "Reopen property (ADMIN)",
      "Reassign property (ADMIN)",
      "Create photo upload URL",
      "Confirm photo",
      "Get photo content",
      "Select cover photo",
      "Reorder photos",
      "Delete photo",
      "Delete property (ADMIN)",
    ]) {
      assert.ok(
        findRequest("Captaciones", requestName),
        `Missing Captaciones request: ${requestName}`,
      );
    }
  });

  it("never sends a password through create or update user", () => {
    const createBody = parseBody(findRequest("Users", "Create user"));
    const createAdminBody = parseBody(
      findRequest("Users", "Create user with ADMIN role"),
    );
    const updateBody = parseBody(findRequest("Users", "Update user"));

    assert.equal("password" in createBody, false);
    assert.equal("password" in createAdminBody, false);
    assert.equal("password" in updateBody, false);
  });

  it("keeps health probes public and points them at the root URL", () => {
    for (const requestName of ["Health", "Ready"]) {
      const request = findRequest("Health", requestName);
      assert.ok(request);
      assert.equal(request.request?.auth?.type, "noauth");
      assert.equal(
        typeof request.request?.url === "string" &&
          request.request.url.startsWith("{{rootUrl}}/"),
        true,
      );
    }
  });

  it("declares the variables used by the collection", () => {
    const keys = new Set(
      (collection.variable ?? []).map((variable) => variable.key),
    );

    for (const key of [
      "baseUrl",
      "rootUrl",
      "loginEmail",
      "loginPassword",
      "newUserPassword",
      "resetToken",
      "accessToken",
      "currentUserId",
      "currentUserRole",
      "targetUserId",
      "propertyId",
      "propertyCode",
      "propertyAgentId",
      "propertyPhotoId",
      "photoBatchId",
      "photoBatchUploadId",
      "coverUploadId",
      "photoUploadUrl",
      "photoUploadKey",
      "photoUploadToken",
    ]) {
      assert.equal(keys.has(key), true, `Missing collection variable: ${key}`);
    }
  });
});
