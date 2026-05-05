import crypto from "node:crypto";

export type EmailChangeTokenPayload = {
  userId: string;
  oldEmail: string;
  newEmail: string;
  exp: number;
};

export function createEmailChangeToken(
  payload: Omit<EmailChangeTokenPayload, "exp">,
  secret: string,
  ttlSeconds = 60 * 60,
): string {
  const body = Buffer.from(
    JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + ttlSeconds }),
  ).toString("base64url");
  const sig = crypto.createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifyEmailChangeToken(token: string, secret: string): EmailChangeTokenPayload {
  const [body, sig] = token.split(".");
  if (!body || !sig) throw new Error("Invalid email change token");
  const expected = crypto.createHmac("sha256", secret).update(body).digest("base64url");
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
    throw new Error("Invalid email change token signature");
  }
  const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as unknown;
  if (!isPayload(payload) || payload.exp < Math.floor(Date.now() / 1000)) {
    throw new Error("Expired email change token");
  }
  return payload;
}

function isPayload(value: unknown): value is EmailChangeTokenPayload {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.userId === "string" &&
    typeof v.oldEmail === "string" &&
    typeof v.newEmail === "string" &&
    typeof v.exp === "number"
  );
}
