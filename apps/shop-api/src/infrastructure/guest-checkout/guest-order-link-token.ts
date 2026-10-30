import { createHash, randomBytes } from "node:crypto";
import type { Database } from "@auction/db";
import { shopGuestOrderLink } from "@auction/db/schema";
import { guestOrderLinkExpiry } from "@auction/shop-domain";

/** 32 random bytes as base64url; only the SHA-256 is stored. */
export function mintGuestOrderLinkToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashGuestOrderLinkToken(token) };
}

export function hashGuestOrderLinkToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/** A token is base64url of 32 bytes; anything else is rejected before touching the database. */
export function isGuestOrderLinkTokenShape(token: string): boolean {
  return /^[A-Za-z0-9_-]{43}$/.test(token);
}

/** The Shop page that opens a guest order from its link. */
export function guestOrderLinkUrl(storefrontUrl: string, token: string): string {
  return new URL(`/orders/guest/${token}`, storefrontUrl).toString();
}

/** Stores a new order-view link in the caller's transaction and returns the raw token once. */
export async function issueGuestOrderLink(
  tx: Database,
  orderId: string,
  now: Date,
): Promise<{ token: string; expiresAt: Date }> {
  const { token, hash } = mintGuestOrderLinkToken();
  const expiresAt = guestOrderLinkExpiry(now);
  await tx.insert(shopGuestOrderLink).values({
    tokenHash: hash,
    orderId,
    purpose: "order_view",
    expiresAt,
    createdAt: now,
  });
  return { token, expiresAt };
}
