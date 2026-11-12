import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { photoUrlSchema } from "../src/validators/photo-url-schema";

const assertAccepted = (value: unknown): void => {
  assert.equal(photoUrlSchema.safeParse(value).success, true);
};

const assertRejected = (value: unknown): void => {
  assert.equal(photoUrlSchema.safeParse(value).success, false);
};

describe("Photo URL validation", () => {
  it("accepts public http and https URLs", () => {
    assertAccepted("https://example.com/photo.jpg");
    assertAccepted("https://cdn.example.com/photos/1.webp?size=large");
    assertAccepted("https://fc.example.com/photo.jpg");
    assertAccepted("https://fd.example.com/photo.jpg");
    assertAccepted("http://example.com/photo.jpg");
  });

  it("accepts null and undefined because the field is optional", () => {
    assertAccepted(null);
    assertAccepted(undefined);
  });

  it("rejects executable and non-http schemes", () => {
    assertRejected("javascript:alert(1)");
    assertRejected("data:text/html,<script>alert(1)</script>");
    assertRejected("ftp://example.com/photo.jpg");
    assertRejected("file:///etc/passwd");
  });

  it("rejects loopback, private and link-local hosts", () => {
    assertRejected("http://localhost:3000/photo.jpg");
    assertRejected("http://127.0.0.1/photo.jpg");
    assertRejected("http://10.0.0.5/photo.jpg");
    assertRejected("http://172.16.0.1/photo.jpg");
    assertRejected("http://192.168.1.10/photo.jpg");
    assertRejected("http://169.254.169.254/latest/meta-data");
    assertRejected("http://[::1]/photo.jpg");
    assertRejected("http://metadata.google.internal/computeMetadata/v1/");
  });

  it("rejects URLs with embedded credentials", () => {
    assertRejected("https://user:password@example.com/photo.jpg");
  });

  it("rejects URLs longer than the limit", () => {
    assertRejected(`https://example.com/${"a".repeat(2048)}`);
  });
});
