import { describe, expect, it } from "vitest";
import { S3ObjectStorage } from "./s3-object-storage.js";

function storage(publicBaseUrl = "https://media.lax.art/") {
  return new S3ObjectStorage({
    bucket: "lax-media",
    region: "eu-west-2",
    accessKeyId: "AKIATEST",
    secretAccessKey: "test-secret",
    publicBaseUrl,
  });
}

describe("S3ObjectStorage public URLs", () => {
  it("joins keys onto the base URL without a doubled slash", () => {
    expect(storage().getPublicUrl("shop/artwork/a.jpg")).toBe(
      "https://media.lax.art/shop/artwork/a.jpg",
    );
  });

  it("extracts keys from bare keys and its own public URLs only", () => {
    const s = storage();
    expect(s.extractKey(" /shop/artwork/a.jpg ")).toBe("shop/artwork/a.jpg");
    expect(s.extractKey("https://media.lax.art/shop/artwork/a%20b.jpg")).toBe(
      "shop/artwork/a b.jpg",
    );
    expect(s.extractKey("https://evil.example/shop/artwork/a.jpg")).toBeNull();
    expect(s.extractKey("https://media.lax.art.evil.example/a.jpg")).toBeNull();
    expect(s.extractKey("   ")).toBeNull();
  });
});

describe("S3ObjectStorage presigned uploads", () => {
  it("signs the content type and length so the upload cannot be swapped", async () => {
    const { url, requiredHeaders } = await storage().createPresignedPut({
      key: "shop/artwork/a.jpg",
      contentType: "image/jpeg",
      byteSize: 1024,
      expiresInSec: 300,
    });
    const signed = new URL(url);
    expect(signed.pathname).toContain("shop/artwork/a.jpg");
    expect(signed.searchParams.get("X-Amz-Expires")).toBe("300");
    expect(signed.searchParams.get("X-Amz-SignedHeaders")).toMatch(/content-length/);
    expect(signed.searchParams.get("X-Amz-SignedHeaders")).toMatch(/content-type/);
    expect(requiredHeaders).toEqual({ "content-type": "image/jpeg" });
  });
});
