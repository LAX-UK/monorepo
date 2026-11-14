import { Sentry } from "@auction/observability";
import type { AppLogger } from "../lib/logger.js";
import type { ZohoBooksNoticeAlerts } from "../services/finance/zoho-books-notice-ingress-application.service.js";

/**
 * The accounting alert for a Books notice whose signature is missing or wrong. Same message as the
 * worker's `ACCOUNTING_ALERTS.noticeSignatureFailed`, where the Sentry alert rule matches on it.
 */
export const ZOHO_BOOKS_NOTICE_SIGNATURE_FAILED = "zoho_books.notice_signature_failed";

/** Logged at error and sent to Sentry; only which check failed is recorded, never the request. */
export function createZohoBooksNoticeAlerts(log: Pick<AppLogger, "error">): ZohoBooksNoticeAlerts {
  return {
    signatureFailed(fields) {
      log.error(
        { event: ZOHO_BOOKS_NOTICE_SIGNATURE_FAILED, ...fields },
        ZOHO_BOOKS_NOTICE_SIGNATURE_FAILED,
      );
      Sentry.captureMessage(ZOHO_BOOKS_NOTICE_SIGNATURE_FAILED, {
        level: "error",
        tags: { alert: ZOHO_BOOKS_NOTICE_SIGNATURE_FAILED },
        extra: { ...fields },
      });
    },
  };
}
