import { createHash, randomBytes } from "node:crypto";

const TOKEN_BYTES = 32;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]+$/;
const TOKEN_MIN_LENGTH = 16;
const TOKEN_MAX_LENGTH = 128;

export type IssuedCheckInToken = {
  plainToken: string;
  tokenHash: string;
};

export function issueCheckInToken(): IssuedCheckInToken {
  const plainToken = randomBytes(TOKEN_BYTES).toString("base64url");
  return { plainToken, tokenHash: hashCheckInToken(plainToken) };
}

export function hashCheckInToken(plainToken: string): string {
  return createHash("sha256").update(plainToken, "utf8").digest("hex");
}

export function hashCheckInInput(input: string): string {
  return createHash("sha256").update(input.trim(), "utf8").digest("hex");
}

export function isValidCheckInTokenFormat(token: string): boolean {
  const trimmed = token.trim();
  return (
    trimmed.length >= TOKEN_MIN_LENGTH &&
    trimmed.length <= TOKEN_MAX_LENGTH &&
    TOKEN_PATTERN.test(trimmed)
  );
}

/** Accepts raw token or full pass URL; returns normalised token segment. */
export function normaliseCheckInToken(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  let candidate = trimmed;
  try {
    if (/^https?:\/\//i.test(trimmed)) {
      const url = new URL(trimmed);
      const segments = url.pathname.split("/").filter(Boolean);
      const passIdx = segments.indexOf("pass");
      if (passIdx >= 0 && segments[passIdx + 1]) {
        candidate = segments[passIdx + 1] ?? candidate;
      } else {
        candidate = segments.at(-1) ?? candidate;
      }
    }
  } catch {
    return null;
  }

  candidate = candidate.trim();
  return isValidCheckInTokenFormat(candidate) ? candidate : null;
}

export function buildPassUrl(micrositeUrl: string | null, plainToken: string): string {
  const base = (micrositeUrl?.trim() || "https://event.lax.bid").replace(/\/$/, "");
  return `${base}/pass/${plainToken}`;
}
