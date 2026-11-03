import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import sharp from "sharp";

/** The largest picture read from another site; a cover or lot photograph is never bigger. */
export const EXTERNAL_PICTURE_MAX_BYTES = 25 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 20_000;

/** Whether an address is private, loopback or link-local (IPv4 or IPv6). */
export function isPrivateAddress(address: string): boolean {
  if (isIP(address) === 6) {
    const lower = address.toLowerCase();
    if (lower === "::1" || lower === "::") return true;
    if (lower.startsWith("fc") || lower.startsWith("fd") || lower.startsWith("fe80")) return true;
    const mapped = lower.startsWith("::ffff:") ? lower.slice(7) : null;
    return mapped ? isPrivateAddress(mapped) : false;
  }
  const parts = address.split(".").map(Number);
  const [a = 0, b = 0] = parts;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127)
  );
}

export type ExternalPictureDeps = {
  fetchImpl?: typeof fetch;
  resolveHost?: (host: string) => Promise<string[]>;
};

async function resolveHostAddresses(host: string): Promise<string[]> {
  const found = await lookup(host, { all: true });
  return found.map((entry) => entry.address);
}

/**
 * Reads a picture held as a full https address. Only public hosts are read, redirects are not
 * followed, and a picture larger than the cap is refused. Throws a short reason on any refusal.
 */
export async function fetchExternalPicture(
  url: string,
  deps: ExternalPictureDeps = {},
): Promise<Buffer> {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:") throw new Error("external_picture_not_https");
  const addresses = isIP(parsed.hostname)
    ? [parsed.hostname]
    : await (deps.resolveHost ?? resolveHostAddresses)(parsed.hostname);
  if (addresses.length === 0 || addresses.some(isPrivateAddress)) {
    throw new Error("external_picture_host_not_public");
  }
  const response = await (deps.fetchImpl ?? fetch)(url, {
    redirect: "error",
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`external_picture_status_${response.status}`);
  const declared = Number(response.headers.get("content-length") ?? 0);
  if (declared > EXTERNAL_PICTURE_MAX_BYTES) throw new Error("external_picture_too_large");
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.byteLength === 0) throw new Error("external_picture_empty");
  if (bytes.byteLength > EXTERNAL_PICTURE_MAX_BYTES) throw new Error("external_picture_too_large");
  return bytes;
}

/** Average brightness of a picture, 0 (black) to 1 (white), on the sRGB luma of its pixels. */
export async function meanLuminance(bytes: Buffer): Promise<number> {
  const { channels } = await sharp(bytes)
    .rotate()
    .resize(64, 64, { fit: "inside" })
    .flatten({ background: "#ffffff" })
    .toColourspace("srgb")
    .removeAlpha()
    .stats();
  const [r, g, b] = channels;
  if (!r || !g || !b) return 0;
  return Math.round(((0.2126 * r.mean + 0.7152 * g.mean + 0.0722 * b.mean) / 255) * 1000) / 1000;
}
