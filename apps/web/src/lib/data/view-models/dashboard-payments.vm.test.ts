import { dashboardCheckoutLotUrl } from "@/lib/dashboard/dashboard-copy";
import type { MyPaymentRow } from "@/lib/data/http/payments.server";
import { describe, expect, it } from "vitest";
import { sortPaymentsNewestFirst, toPaymentDisplayRows } from "./dashboard-payments.vm";

function row(overrides: Partial<MyPaymentRow> = {}): MyPaymentRow {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    lotId: "22222222-2222-4222-8222-222222222222",
    lotTitle: "Untitled, oil on canvas",
    lotImageUrl: "https://cdn.example/lot.jpg",
    amount: "1500.00",
    platformFee: "75.00",
    currency: "GBP",
    status: "captured",
    createdAt: "2026-04-01T10:00:00.000Z",
    invoiceUrl: "https://invoice.xero.example/abc",
    invoiceNumber: "INV-001",
    checkoutRail: null,
    manualReviewReason: null,
    ...overrides,
  };
}

describe("toPaymentDisplayRows", () => {
  it("formats money via Intl and exposes both date strings", () => {
    const [out] = toPaymentDisplayRows([row()]);
    expect(out).toBeDefined();
    if (!out) return;
    expect(out.amountLabel).toMatch(/1,500/);
    expect(out.createdAtIso).toBe("2026-04-01T10:00:00.000Z");
    expect(out.createdAtLabel.length).toBeGreaterThan(0);
  });

  it("captured status yields success tone and 'Paid' label", () => {
    const [out] = toPaymentDisplayRows([row({ status: "captured" })]);
    expect(out?.statusTone).toBe("success");
    expect(out?.statusLabel).toBe("Paid");
  });

  it("pending status yields a Pay-now action targeted at the per-lot checkout", () => {
    const [out] = toPaymentDisplayRows([row({ status: "pending", lotId: "abc-123" })]);
    expect(out?.primaryAction).toEqual({
      kind: "pay",
      href: dashboardCheckoutLotUrl("abc-123"),
      label: "Pay now",
    });
  });

  it("pending status with a compliance reason yields a review action (not Pay-now)", () => {
    const [out] = toPaymentDisplayRows([
      row({ status: "pending", lotId: "abc-123", manualReviewReason: "source_of_funds_required" }),
    ]);
    expect(out?.primaryAction).toEqual({
      kind: "review",
      href: dashboardCheckoutLotUrl("abc-123"),
      reason: "source_of_funds_required",
    });
  });

  it("requires_manual_review with a reason yields a review action instead of none", () => {
    const [out] = toPaymentDisplayRows([
      row({
        status: "requires_manual_review",
        lotId: "abc-123",
        invoiceUrl: null,
        manualReviewReason: "high_value",
      }),
    ]);
    expect(out?.primaryAction).toEqual({
      kind: "review",
      href: dashboardCheckoutLotUrl("abc-123"),
      reason: "high_value",
    });
  });

  it("non-pending status with invoice URL yields an invoice action with a labelled aria-label", () => {
    const [out] = toPaymentDisplayRows([
      row({
        status: "captured",
        invoiceUrl: "https://example/inv",
        lotTitle: "Two figures",
      }),
    ]);
    expect(out?.primaryAction).toEqual({
      kind: "invoice",
      href: "https://example/inv",
      label: "View invoice",
      ariaLabel: "Open invoice for Two figures (opens in a new tab)",
    });
  });

  it("non-pending status without invoice URL yields no action", () => {
    const [out] = toPaymentDisplayRows([row({ status: "captured", invoiceUrl: null })]);
    expect(out?.primaryAction).toEqual({ kind: "none" });
  });

  it("falls back to ISO label when createdAt is unparseable", () => {
    const [out] = toPaymentDisplayRows([row({ createdAt: "not-a-date" })]);
    expect(out?.createdAtLabel).toBe("not-a-date");
  });

  it("preserves the input ordering (sorting is a separate step)", () => {
    const a = row({ id: "a", createdAt: "2026-01-01T00:00:00.000Z" });
    const b = row({ id: "b", createdAt: "2026-02-01T00:00:00.000Z" });
    const out = toPaymentDisplayRows([a, b]);
    expect(out.map((r) => r.id)).toEqual(["a", "b"]);
  });
});

describe("sortPaymentsNewestFirst", () => {
  it("sorts most-recent first", () => {
    const a = row({ id: "a", createdAt: "2026-01-01T00:00:00.000Z" });
    const b = row({ id: "b", createdAt: "2026-02-01T00:00:00.000Z" });
    const c = row({ id: "c", createdAt: "2026-03-01T00:00:00.000Z" });
    const sorted = sortPaymentsNewestFirst(toPaymentDisplayRows([a, b, c]));
    expect(sorted.map((r) => r.id)).toEqual(["c", "b", "a"]);
  });

  it("is stable on ties", () => {
    const a = row({ id: "a", createdAt: "2026-01-01T00:00:00.000Z" });
    const b = row({ id: "b", createdAt: "2026-01-01T00:00:00.000Z" });
    const sorted = sortPaymentsNewestFirst(toPaymentDisplayRows([a, b]));
    expect(sorted.map((r) => r.id)).toEqual(["a", "b"]);
  });
});
