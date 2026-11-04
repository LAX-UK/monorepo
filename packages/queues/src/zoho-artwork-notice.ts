import { createHash } from "node:crypto";

/**
 * Notices from Zoho that an artwork Product changed. The API stores each one as an inbound
 * webhook event under this source and the worker reads the Product itself, so the notice only
 * has to say which Product and when it changed.
 */
export const ZOHO_ARTWORK_WEBHOOK_SOURCE = "zoho_artwork" as const;

/** What the API stores as the routing of a Zoho artwork notice. */
export type ZohoArtworkNoticeRouting = {
  productId: string;
  /** Zoho's modified time for the change, ISO 8601, when the workflow sent it. */
  modifiedTime?: string;
};

const MINUTE_MS = 60_000;

/**
 * The key a notice is stored (and queued) under. A notice for the same Product and the same modified time is
 * the same notice, so Zoho retrying a delivery stores it once. When the workflow sends no
 * modified time, notices in the same minute count as one: the worker reads the Product as it is
 * then, so a second notice a few seconds later adds nothing.
 */
export function zohoArtworkNoticeEventKey(
  routing: ZohoArtworkNoticeRouting,
  receivedAt: Date,
): string {
  const when =
    routing.modifiedTime ?? `received-${Math.floor(receivedAt.getTime() / MINUTE_MS) * MINUTE_MS}`;
  // Job ids cannot contain a colon, so the key is a hash of the two parts.
  const digest = createHash("sha256").update(`${routing.productId}|${when}`).digest("hex");
  return `zoho-artwork-${digest.slice(0, 40)}`;
}
