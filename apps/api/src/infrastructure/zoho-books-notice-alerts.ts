import { Sentry } from "@auction/observability";
import type { AppLogger } from "../lib/logger.js";
import type { ZohoBooksNoticeAlerts } from "../services/finance/zoho-books-notice-ingress-application.service.js";

/**
 * The accounting alert for a Books notice whose signature is missing or wrong. Same message as the
 * worker's `ACCOUNTING_ALERTS.noticeSignatureFailed`, where the Sentry alert rule matches on it.
 */
export const ZOHO_BOOKS_NOTICE_SIGNATURE_FAILED = "zoho_books.notice_signature_failed";

/**
 * Only which check failed is recorded, never the request. A request with no signature at all is
 * what ordinary internet scanning of a public route looks like: logged at warn, never sent to
 * Sentry. A signature that does not verify is logged at error and sent to Sentry as a warning,
 * every one grouped as one issue: the alert rule pages on a rate of these, not on each one.
 */
export function createZohoBooksNoticeAlerts(
  log: Pick<AppLogger, "warn" | "error">,
): ZohoBooksNoticeAlerts {
  return {
    signatureFailed(fields) {
      const entry = { event: ZOHO_BOOKS_NOTICE_SIGNATURE_FAILED, ...fields };
      if (fields.reason === "missing") {
        log.warn(entry, ZOHO_BOOKS_NOTICE_SIGNATURE_FAILED);
        return;
      }
      log.error(entry, ZOHO_BOOKS_NOTICE_SIGNATURE_FAILED);
      Sentry.captureMessage(ZOHO_BOOKS_NOTICE_SIGNATURE_FAILED, {
        level: "warning",
        tags: { alert: ZOHO_BOOKS_NOTICE_SIGNATURE_FAILED, reason: fields.reason },
        fingerprint: [ZOHO_BOOKS_NOTICE_SIGNATURE_FAILED, fields.reason],
        extra: { ...fields },
      });
    },
  };
}
