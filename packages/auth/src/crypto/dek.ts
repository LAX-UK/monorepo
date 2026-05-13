import { Buffer } from "node:buffer";

/** Parse `AUTH_DEK_KEY`: 64 hex chars → 32 bytes, or standard base64 / base64url of 32 raw bytes. */
export function parseAuthDekKey(raw: string): Buffer {
  const trimmed = raw.trim();
  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    return Buffer.from(trimmed, "hex");
  }
  const b64 = trimmed.replace(/-/g, "+").replace(/_/g, "/");
  const pad = b64.length % 4 === 0 ? "" : "=".repeat(4 - (b64.length % 4));
  const buf = Buffer.from(b64 + pad, "base64");
  if (buf.length !== 32) {
    throw new Error(
      "AUTH_DEK_KEY must decode to exactly 32 bytes (use 64 hex chars or base64 of 32 bytes)",
    );
  }
  return buf;
}
