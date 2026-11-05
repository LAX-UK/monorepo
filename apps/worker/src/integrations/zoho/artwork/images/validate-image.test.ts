import { describe, expect, it } from "vitest";
import { looksLikeImageFile, sha256Hex, sniffImageType, storedImageKey } from "./validate-image.js";

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]);
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
const WEBP = Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4), Buffer.from("WEBPVP8 ")]);

describe("sniffImageType", () => {
  it("reads the type from the bytes", () => {
    expect(sniffImageType(JPEG)).toBe("image/jpeg");
    expect(sniffImageType(PNG)).toBe("image/png");
    expect(sniffImageType(WEBP)).toBe("image/webp");
  });

  it("refuses anything else, whatever the file was called", () => {
    expect(sniffImageType(Buffer.from("%PDF-1.7"))).toBeNull();
    expect(sniffImageType(Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'/>"))).toBeNull();
    expect(sniffImageType(Buffer.from("GIF89a......"))).toBeNull();
    expect(sniffImageType(Buffer.alloc(0))).toBeNull();
    expect(sniffImageType(Buffer.from("RIFF....WAVEfmt "))).toBeNull();
  });
});

describe("storedImageKey", () => {
  it("is the same for the same content and differs for different content", () => {
    const a = sha256Hex(Buffer.from("one"));
    const b = sha256Hex(Buffer.from("two"));
    expect(storedImageKey(a, "image/jpeg")).toBe(
      storedImageKey(sha256Hex(Buffer.from("one")), "image/jpeg"),
    );
    expect(storedImageKey(a, "image/jpeg")).not.toBe(storedImageKey(b, "image/jpeg"));
  });

  it("sits under the prefix Shop serves artwork images from, with the real extension", () => {
    const hash = "0123456789abcdef".repeat(4);
    expect(storedImageKey(hash, "image/png")).toBe(`shop/artwork/zoho-${hash.slice(0, 32)}.png`);
    expect(storedImageKey(hash, "image/webp")).toMatch(/\.webp$/);
  });
});

describe("looksLikeImageFile", () => {
  it("accepts picture file names in any case and rejects documents and nameless attachments", () => {
    expect(looksLikeImageFile("Front.JPG")).toBe(true);
    expect(looksLikeImageFile("detail.jpeg")).toBe(true);
    expect(looksLikeImageFile("certificate.pdf")).toBe(false);
    expect(looksLikeImageFile("scan.tiff")).toBe(false);
    expect(looksLikeImageFile(null)).toBe(false);
  });
});
