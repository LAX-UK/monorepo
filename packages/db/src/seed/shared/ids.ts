/**
 * Deterministic identifier helpers for seed scripts.
 *
 * The catalogue-specific namespaces and bootstrap IDs that previously lived here
 * were tied to the consumed production CSV bootstrap and have been removed.
 * Future seed bootstraps should declare their own namespace UUIDs co-located
 * with the seeder that consumes them and call `uuidV5` below.
 */

import { createHash } from "node:crypto";

function uuidToBytes(uuidStr: string): Buffer {
  const hex = uuidStr.replace(/-/g, "");
  if (hex.length !== 32) {
    throw new Error(`uuidV5: invalid namespace UUID: ${uuidStr}`);
  }
  return Buffer.from(hex, "hex");
}

function formatUuid(bytes: Buffer): string {
  const h = bytes.toString("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}

/**
 * RFC 4122 UUID v5 (SHA-1) over UTF-8 `name` within `namespace` (a UUID string).
 * Stable across runs: re-seeding produces the same primary keys so URLs and caches stay valid.
 */
export function uuidV5(namespace: string, name: string): string {
  const nsBytes = uuidToBytes(namespace);
  const hash = createHash("sha1");
  hash.update(nsBytes);
  hash.update(name, "utf8");
  const digest = hash.digest();
  const out = Buffer.alloc(16);
  digest.copy(out, 0, 0, 16);
  const b6 = out[6];
  const b8 = out[8];
  if (b6 === undefined || b8 === undefined) {
    throw new Error("uuidV5: unexpected digest length");
  }
  out[6] = (b6 & 0x0f) | 0x50;
  out[8] = (b8 & 0x3f) | 0x80;
  return formatUuid(out);
}
