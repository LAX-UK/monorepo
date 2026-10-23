import { createHmac, timingSafeEqual } from "node:crypto";

export const EMAIL_CHANGE_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;

export type EmailChangeTokenPayload = {
  subjectId: string;
  oldEmail: string;
  newEmail: string;
  /** Which inbox must click this link: both confirm before the address switches. */
  confirmFor: "old" | "new";
  exp: number;
};

/**
 * The signing key is derived from the issuer secret with a purpose label, so a signature made
 * for one purpose can never be replayed as another and no extra secret has to be provisioned.
 */
function signingKey(authSecret: string): Buffer {
  return createHmac("sha256", authSecret).update("lax-email-change-token-v1").digest();
}

function sign(body: string, authSecret: string): string {
  return createHmac("sha256", signingKey(authSecret)).update(body).digest("base64url");
}

export function createEmailChangeToken(
  payload: Omit<EmailChangeTokenPayload, "exp">,
  authSecret: string,
  now: Date,
): string {
  const exp = Math.floor(now.getTime() / 1000) + EMAIL_CHANGE_TOKEN_TTL_SECONDS;
  const body = Buffer.from(JSON.stringify({ ...payload, exp })).toString("base64url");
  return `${body}.${sign(body, authSecret)}`;
}

/** Returns the payload of a genuine, unexpired token, or null for anything else. */
export function verifyEmailChangeToken(
  token: string,
  authSecret: string,
  now: Date,
): EmailChangeTokenPayload | null {
  const [body, signature, ...rest] = token.split(".");
  if (!body || !signature || rest.length > 0) return null;
  const expected = Buffer.from(sign(body, authSecret));
  const actual = Buffer.from(signature);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  let payload: unknown;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (!isPayload(payload) || payload.exp < Math.floor(now.getTime() / 1000)) return null;
  return payload;
}

function isPayload(value: unknown): value is EmailChangeTokenPayload {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.subjectId === "string" &&
    typeof v.oldEmail === "string" &&
    typeof v.newEmail === "string" &&
    (v.confirmFor === "old" || v.confirmFor === "new") &&
    typeof v.exp === "number"
  );
}
