import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * A one-time message from a server action to the page it redirects to, carried in a signed value
 * instead of the URL. The value names the page it is for and when it stops being valid, so it
 * cannot be forged, replayed on another page or kept for later.
 */
export type AdminFlashKind = "error" | "success";

export type AdminFlash = {
  kind: AdminFlashKind;
  message: string;
};

type AdminFlashPayload = {
  k: AdminFlashKind;
  m: string;
  p: string;
  e: number;
};

export const ADMIN_FLASH_TTL_SECONDS = 60;
export const ADMIN_FLASH_MAX_MESSAGE_LENGTH = 500;

const VERSION = "v1";

function stripControlChars(value: string): string {
  let out = "";
  for (const char of value) {
    const code = char.charCodeAt(0);
    const isControl =
      code <= 0x08 ||
      code === 0x0b ||
      code === 0x0c ||
      (code >= 0x0e && code <= 0x1f) ||
      code === 0x7f;
    if (!isControl) out += char;
  }
  return out;
}

/** Control characters out, trimmed and capped, so a long API message stays one readable notice. */
export function normaliseFlashMessage(value: string): string | null {
  const cleaned = stripControlChars(value).trim();
  if (!cleaned) return null;
  return cleaned.length <= ADMIN_FLASH_MAX_MESSAGE_LENGTH
    ? cleaned
    : `${cleaned.slice(0, ADMIN_FLASH_MAX_MESSAGE_LENGTH)}…`;
}

function sign(key: Buffer, body: string): Buffer {
  return createHmac("sha256", key).update(`${VERSION}.${body}`).digest();
}

/** Signs a message for one path. An empty message yields no token. */
export function signAdminFlash(
  input: AdminFlash & { path: string },
  key: Buffer,
  nowMs: number,
  ttlSeconds: number = ADMIN_FLASH_TTL_SECONDS,
): string | null {
  const message = normaliseFlashMessage(input.message);
  if (!message) return null;
  const payload: AdminFlashPayload = {
    k: input.kind,
    m: message,
    p: input.path,
    e: nowMs + ttlSeconds * 1000,
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${VERSION}.${body}.${sign(key, body).toString("base64url")}`;
}

function isPayload(value: unknown): value is AdminFlashPayload {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    (v.k === "error" || v.k === "success") &&
    typeof v.m === "string" &&
    typeof v.p === "string" &&
    typeof v.e === "number"
  );
}

/**
 * The message when the token is ours, unexpired and meant for `path`; otherwise null. Every
 * failure looks the same to the caller: the page just shows nothing.
 */
export function verifyAdminFlash(
  token: string | null | undefined,
  key: Buffer,
  nowMs: number,
  path: string,
): AdminFlash | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== VERSION) return null;
  const [, body, signature] = parts as [string, string, string];

  const expected = sign(key, body);
  const given = Buffer.from(signature, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;

  let payload: unknown;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (!isPayload(payload)) return null;
  if (payload.p !== path || payload.e <= nowMs) return null;
  const message = normaliseFlashMessage(payload.m);
  return message ? { kind: payload.k, message } : null;
}
