import crypto from "node:crypto";

/** Links in visitor sale-alert emails. They carry no personal data and cannot be forged. */
export type VisitorAlertTokenPayload =
  | { kind: "confirm"; subscriberId: string; requestedAtMs: number }
  | { kind: "unsubscribe"; subscriberId: string };

// Keeps these signatures apart from the account unsubscribe tokens that share the secret.
const DOMAIN = "visitor-sale-alerts.v1.";

function sign(body: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(`${DOMAIN}${body}`).digest("base64url");
}

export function createVisitorAlertToken(payload: VisitorAlertTokenPayload, secret: string): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body, secret)}`;
}

/** The payload when the signature is genuine and it is the kind asked for, otherwise null. */
export function verifyVisitorAlertToken<K extends VisitorAlertTokenPayload["kind"]>(
  token: string,
  secret: string,
  kind: K,
): Extract<VisitorAlertTokenPayload, { kind: K }> | null {
  const [body, sig, extra] = token.split(".");
  if (!body || !sig || extra !== undefined) return null;
  const expected = Buffer.from(sign(body, secret));
  const given = Buffer.from(sig);
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as unknown;
    return isPayload(parsed, kind) ? parsed : null;
  } catch {
    return null;
  }
}

function isPayload<K extends VisitorAlertTokenPayload["kind"]>(
  value: unknown,
  kind: K,
): value is Extract<VisitorAlertTokenPayload, { kind: K }> {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  if (v.kind !== kind || typeof v.subscriberId !== "string") return false;
  return kind === "confirm" ? typeof v.requestedAtMs === "number" : true;
}
