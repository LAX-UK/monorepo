import crypto from "node:crypto";

/** Notice types a person can turn off from the email itself (their email switch for it). */
export const OPT_OUT_TYPES = [
  "outbid",
  "lot_won",
  "lot_ended_seller",
  "watchlist_reminder",
] as const;
export type OptOutType = (typeof OPT_OUT_TYPES)[number];

export type UnsubscribeTokenPayload =
  | {
      scope: "type";
      userId: string;
      notificationType: OptOutType;
    }
  | {
      scope: "global";
      userId: string;
    };

export function createUnsubscribeToken(payload: UnsubscribeTokenPayload, secret: string): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = sign(body, secret);
  return `${body}.${sig}`;
}

export function verifyUnsubscribeToken(token: string, secret: string): UnsubscribeTokenPayload {
  const [body, sig] = token.split(".");
  if (!body || !sig) throw new Error("Invalid unsubscribe token");
  const expected = sign(body, secret);
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
    throw new Error("Invalid unsubscribe token signature");
  }
  const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as unknown;
  if (!isPayload(parsed)) throw new Error("Invalid unsubscribe token payload");
  return parsed;
}

function sign(body: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(body).digest("base64url");
}

function isPayload(value: unknown): value is UnsubscribeTokenPayload {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  if (v.scope === "global") return typeof v.userId === "string";
  return (
    v.scope === "type" &&
    typeof v.userId === "string" &&
    (OPT_OUT_TYPES as readonly unknown[]).includes(v.notificationType)
  );
}
