import { createHash } from "node:crypto";

export type StoredImageType = "image/jpeg" | "image/png" | "image/webp";

/** The most a stored picture may weigh; the same limit Shop applies to artwork images. */
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

const EXTENSIONS: Record<StoredImageType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** The type the bytes really are, from their first bytes; Zoho's file name and headers are not trusted. */
export function sniffImageType(bytes: Buffer): StoredImageType | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(PNG_SIGNATURE)) return "image/png";
  if (
    bytes.length >= 12 &&
    bytes.subarray(0, 4).toString("ascii") === "RIFF" &&
    bytes.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

export function sha256Hex(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/**
 * The storage key for a picture: under the artwork-image prefix Shop serves from, named by the hash
 * of the file Zoho gave, so the same picture is one object however often it is seen.
 */
export function storedImageKey(sha256: string, type: StoredImageType): string {
  return `shop/artwork/zoho-${sha256.slice(0, 32)}.${EXTENSIONS[type]}`;
}

/** File names Zoho attachments are accepted by; the content is checked again after download. */
export function looksLikeImageFile(fileName: string | null): boolean {
  return fileName !== null && /\.(jpe?g|png|webp)$/i.test(fileName.trim());
}
