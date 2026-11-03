import { hashLinkToken, mintLinkToken } from "./link-token.js";

/** 32 random bytes as base64url (43 characters); only its SHA-256 is stored. */
export function mintEditionAlertToken(): { token: string; hash: string } {
  const token = mintLinkToken();
  return { token, hash: hashLinkToken(token) };
}

export function hashEditionAlertToken(token: string): string {
  return hashLinkToken(token);
}

/** Shop page that stops alerts; it also takes the one-click POST from mail apps. */
export function editionAlertUnsubscribeUrl(shopOrigin: string, token: string): string {
  const url = new URL("/alerts/unsubscribe", shopOrigin);
  url.searchParams.set("token", token);
  return url.toString();
}
