import { createHash, randomBytes } from "node:crypto";

/** 32 random bytes as base64url (43 characters); only its SHA-256 is stored. */
export function mintEditionAlertToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashEditionAlertToken(token) };
}

export function hashEditionAlertToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/** Shop page that stops alerts; it also takes the one-click POST from mail apps. */
export function editionAlertUnsubscribeUrl(shopOrigin: string, token: string): string {
  const url = new URL("/alerts/unsubscribe", shopOrigin);
  url.searchParams.set("token", token);
  return url.toString();
}
