import { createHash, randomBytes } from "node:crypto";

/** 32 random bytes as base64url (43 characters), for links in emails. */
export function mintLinkToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashLinkToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}
