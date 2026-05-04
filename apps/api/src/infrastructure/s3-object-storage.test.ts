import { describe, expect, it } from "vitest";
import { S3ObjectStorage } from "./s3-object-storage.js";

function storage() {
  return new S3ObjectStorage({
    bucket: "bucket",
    region: "us-east-1",
    accessKeyId: "test",
    secretAccessKey: "test",
    publicBaseUrl: "https://cdn.example.com",
  });
}

describe("S3ObjectStorage", () => {
  it("extracts keys from raw values and owned public URLs", () => {
    const s = storage();

    expect(s.extractKey("uploads/pending/avatar/u/1.webp")).toBe("uploads/pending/avatar/u/1.webp");
    expect(s.extractKey("https://cdn.example.com/uploads/pending/avatar/u/1.webp")).toBe(
      "uploads/pending/avatar/u/1.webp",
    );
    expect(s.extractKey("https://other.example.com/uploads/pending/avatar/u/1.webp")).toBeNull();
  });

  it("creates presigned GET URLs for owned keys without making a network call", async () => {
    const s = storage();

    const signed = await s.createPresignedGet({
      key: "uploads/pending/avatar/u/1.webp",
      expiresInSec: 900,
    });

    expect(signed.url).toContain("X-Amz-Signature=");
    expect(signed.url).toContain("uploads/pending/avatar/u/1.webp");
  });
});
