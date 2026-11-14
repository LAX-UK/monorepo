import { beforeEach, describe, expect, it, vi } from "vitest";

const sentry = vi.hoisted(() => ({ captureMessage: vi.fn() }));
vi.mock("@auction/observability", () => ({ Sentry: sentry }));

const { ZOHO_BOOKS_NOTICE_SIGNATURE_FAILED, createZohoBooksNoticeAlerts } = await import(
  "./zoho-books-notice-alerts.js"
);

describe("the Books notice signature alert", () => {
  beforeEach(() => sentry.captureMessage.mockClear());

  it("a request with no signature is only logged at warn: scanning is not sent to Sentry", () => {
    const log = { warn: vi.fn(), error: vi.fn() };
    createZohoBooksNoticeAlerts(log).signatureFailed({ reason: "missing" });
    expect(log.warn).toHaveBeenCalledWith(
      { event: ZOHO_BOOKS_NOTICE_SIGNATURE_FAILED, reason: "missing" },
      ZOHO_BOOKS_NOTICE_SIGNATURE_FAILED,
    );
    expect(log.error).not.toHaveBeenCalled();
    expect(sentry.captureMessage).not.toHaveBeenCalled();
  });

  it("a signature that does not verify goes to Sentry as one grouped warning, for a rate rule", () => {
    const log = { warn: vi.fn(), error: vi.fn() };
    createZohoBooksNoticeAlerts(log).signatureFailed({ reason: "invalid" });
    expect(log.error).toHaveBeenCalledWith(
      { event: ZOHO_BOOKS_NOTICE_SIGNATURE_FAILED, reason: "invalid" },
      ZOHO_BOOKS_NOTICE_SIGNATURE_FAILED,
    );
    expect(sentry.captureMessage).toHaveBeenCalledWith(ZOHO_BOOKS_NOTICE_SIGNATURE_FAILED, {
      level: "warning",
      tags: { alert: ZOHO_BOOKS_NOTICE_SIGNATURE_FAILED, reason: "invalid" },
      fingerprint: [ZOHO_BOOKS_NOTICE_SIGNATURE_FAILED, "invalid"],
      extra: { reason: "invalid" },
    });
  });
});
