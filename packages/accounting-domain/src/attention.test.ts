import { describe, expect, it } from "vitest";
import {
  QUEUE_TABS,
  canTryAgain,
  isLockedPeriodReason,
  isQueueTab,
  queueTabFor,
} from "./attention.js";
import type { DocumentRecord } from "./lifecycle.js";

const core = { kind: "invoice", reference: "LAX-BID-INV-abc", attempts: 1 } as const;
const issued = { number: "INV-1", providerId: "1", pdfRef: null };

describe("queue tabs", () => {
  it("puts each status in one tab and leaves cancelled out", () => {
    const cases: [DocumentRecord, string | null][] = [
      [{ ...core, status: "pending" }, "waiting"],
      [{ ...core, status: "sending", lease: { token: "t", expiresAtMs: 1 } }, "waiting"],
      [{ ...core, status: "unknown", settlesAtMs: 1 }, "waiting"],
      [{ ...core, status: "issued", issued }, "issued"],
      [{ ...core, status: "failed", reason: "zoho_books_validation_invalid_request" }, "failed"],
      [
        {
          ...core,
          status: "needs_review",
          lookup: "clear",
          reason: "r",
          issued: null,
          mismatch: null,
        },
        "needs_person",
      ],
      [{ ...core, status: "cancelled" }, null],
    ];
    for (const [record, tab] of cases) expect(queueTabFor(record)).toBe(tab);
  });

  it("sends a locked-period refusal to a person, not to Failed", () => {
    expect(
      queueTabFor({ ...core, status: "failed", reason: "zoho_books_validation_period_locked" }),
    ).toBe("needs_person");
    expect(isLockedPeriodReason("fake_period_locked")).toBe(true);
    expect(isLockedPeriodReason("zoho_books_rate_limited_rate_limited")).toBe(false);
    expect(isLockedPeriodReason(null)).toBe(false);
  });

  it("knows its tab names", () => {
    expect(QUEUE_TABS.every(isQueueTab)).toBe(true);
    expect(isQueueTab("cancelled")).toBe(false);
  });
});

describe("try again", () => {
  it("is offered exactly when the life cycle would requeue", () => {
    expect(canTryAgain({ ...core, status: "failed", reason: "x" })).toBe(true);
    expect(
      canTryAgain({
        ...core,
        status: "needs_review",
        lookup: "clear",
        reason: "r",
        issued: null,
        mismatch: null,
      }),
    ).toBe(true);
    expect(
      canTryAgain({
        ...core,
        status: "needs_review",
        lookup: "clear",
        reason: "r",
        issued,
        mismatch: null,
      }),
    ).toBe(false);
    expect(
      canTryAgain({ ...core, status: "needs_review", lookup: "owed", reason: "r", settlesAtMs: 1 }),
    ).toBe(false);
    expect(canTryAgain({ ...core, status: "pending" })).toBe(false);
    expect(canTryAgain({ ...core, status: "issued", issued })).toBe(false);
  });
});
