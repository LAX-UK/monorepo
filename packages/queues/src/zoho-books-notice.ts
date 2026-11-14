import { createHash } from "node:crypto";

/**
 * Notices from a Zoho Books workflow that a document changed there. The API stores each one as an
 * inbound webhook event under this source; the worker treats it only as a hint to read that
 * document's state from Books again. Nothing in a notice is ever trusted for money.
 */
export const ZOHO_BOOKS_WEBHOOK_SOURCE = "zoho_books" as const;

/** The Books modules a notice may name: the ones the nightly status check reads. */
export const ZOHO_BOOKS_NOTICE_MODULES = ["invoice", "creditnote", "customerpayment"] as const;
export type ZohoBooksNoticeModule = (typeof ZOHO_BOOKS_NOTICE_MODULES)[number];

/** What the API stores of a Books notice: Books' ids and when, nothing else. */
export type ZohoBooksNoticeRouting = {
  organizationId: string;
  module: ZohoBooksNoticeModule;
  /** The Books id of the document that changed. */
  entityId: string;
  /** Books' time for the change, ISO 8601, from the signed body (a notice without one is refused). */
  eventTime: string;
};

/**
 * The key a notice is stored (and queued) under, from Books' ids and its signed change time: the
 * same organisation, document and change time is the same notice, so a retried or replayed
 * delivery is stored once.
 */
export function zohoBooksNoticeEventKey(routing: ZohoBooksNoticeRouting): string {
  const digest = createHash("sha256")
    .update(`${routing.organizationId}|${routing.module}|${routing.entityId}|${routing.eventTime}`)
    .digest("hex");
  // Job ids cannot contain a colon, so the key is a hash.
  return `zoho-books-${digest.slice(0, 40)}`;
}
