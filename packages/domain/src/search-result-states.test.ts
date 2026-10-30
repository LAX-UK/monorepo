import { describe, expect, it } from "vitest";
import { bidOutcome, purchasePaymentState } from "./search-result-states.js";

const invoicedAt = new Date("2026-10-01T12:00:00Z");
const day = 86_400_000;
const daysLater = (days: number) => new Date(invoicedAt.getTime() + days * day);

describe("purchasePaymentState", () => {
  it.each([null, "pending", "cancelled", "requires_manual_review"] as const)(
    "%s: due within seven days, overdue after",
    (paymentStatus) => {
      expect(purchasePaymentState({ paymentStatus, invoicedAt, now: daysLater(7) })).toBe("due");
      expect(purchasePaymentState({ paymentStatus, invoicedAt, now: daysLater(7.01) })).toBe(
        "overdue",
      );
    },
  );

  it("paid, being processed or refunded, whatever the date", () => {
    const now = daysLater(30);
    expect(purchasePaymentState({ paymentStatus: "captured", invoicedAt, now })).toBe("paid");
    expect(purchasePaymentState({ paymentStatus: "authorized", invoicedAt, now })).toBe(
      "processing",
    );
    expect(purchasePaymentState({ paymentStatus: "refunded", invoicedAt, now })).toBe("refunded");
  });
});

describe("bidOutcome", () => {
  it("open lots: leading or outbid", () => {
    expect(bidOutcome({ lotStatus: "active", leading: true, won: false })).toBe("leading");
    expect(bidOutcome({ lotStatus: "active", leading: false, won: false })).toBe("outbid");
  });

  it("closed lots: won or lost", () => {
    expect(bidOutcome({ lotStatus: "ended", leading: false, won: true })).toBe("won");
    expect(bidOutcome({ lotStatus: "ended", leading: true, won: false })).toBe("lost");
  });

  it.each(["draft", "scheduled", "cancelled", "voided"] as const)("%s: no outcome", (lotStatus) => {
    expect(bidOutcome({ lotStatus, leading: true, won: true })).toBeNull();
  });
});
