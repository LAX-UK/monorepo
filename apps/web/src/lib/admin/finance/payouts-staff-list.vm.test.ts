import type { AdminPayoutListSummary } from "@/lib/data/http/admin-payouts.shared";
import type { AdminPayoutRow } from "@/lib/data/http/admin.server";
import { describe, expect, it } from "vitest";
import {
  activePayoutsView,
  formatPayoutAmount,
  parseSignedPounds,
  payoutPanelHref,
  payoutPeriod,
  payoutsAttention,
  payoutsFilterChips,
  payoutsListHref,
  payoutsMetrics,
  payoutsRangeSummary,
  payoutsViews,
  toPayoutsStaffRows,
} from "./payouts-staff-list.vm";

const summary: AdminPayoutListSummary = {
  total: 40,
  scheduled: 10,
  inTransit: 5,
  paid: 20,
  failed: 3,
  reversed: 1,
  clawbackPending: 1,
  totalNet: "1234.5",
  readiness: {
    inFlightCount: 15,
    missingTransferRefCount: 2,
    withFailureReasonCount: 1,
    withStatementErrorCount: 0,
    clawbackCount: 1,
    failedCount: 3,
    reversedCount: 1,
    blockerPayoutCount: 4,
  },
};

const row: AdminPayoutRow = {
  id: "payout_1",
  legalEntityId: "11111111-2222-3333-4444-555555555555",
  periodStart: "2026-10-01T00:00:00.000Z",
  periodEnd: "2026-10-31T00:00:00.000Z",
  grossAmount: "5000",
  platformFee: "500.5",
  stripeFee: "0",
  netAmount: "4499.5",
  currency: "GBP",
  status: "scheduled",
  stripeTransferId: null,
  xeroBillId: null,
  failureReason: null,
  processedAt: null,
  statementUrl: null,
  statementGenerationError: null,
  createdAt: "2026-11-01T00:00:00.000Z",
};

describe("payouts staff list view model", () => {
  it("shows a paid date only for a payout that was paid", () => {
    const at = "2026-10-05T09:00:00.000Z";
    const paidAt = (status: AdminPayoutRow["status"]) =>
      toPayoutsStaffRows([{ ...row, status, processedAt: at }])[0]?.paidAt;
    expect(paidAt("paid")).toBe(at);
    expect(paidAt("clawback_pending")).toBe(at);
    for (const status of ["scheduled", "in_transit", "failed", "reversed"] as const) {
      expect(paidAt(status)).toBeNull();
    }
  });

  it("takes the seller's name from the list read", () => {
    const [named] = toPayoutsStaffRows([{ ...row, legalEntityName: "Halcyon Gallery Ltd" }]);
    expect(named?.seller).toBe("Halcyon Gallery Ltd");
  });

  it("formats amounts in full pounds, with a true minus", () => {
    expect(formatPayoutAmount("4499.5")).toBe("£4,499.50");
    expect(formatPayoutAmount("-25")).toBe("−£25.00");
    expect(formatPayoutAmount("not money")).toBe("not money");
  });

  it("turns rows into plain data with the seller's name and the steps open to the payout", () => {
    const names = new Map([[row.legalEntityId, "Gallery One"]]);
    const [scheduled, paid, failed] = toPayoutsStaffRows(
      [row, { ...row, id: "p2", status: "paid" }, { ...row, id: "p3", status: "failed" }],
      names,
    );
    expect(scheduled).toMatchObject({
      seller: "Gallery One",
      period: "1 Oct 2026 – 31 Oct 2026",
      net: "£4,499.50",
      netPence: 449_950,
      canMarkPaid: true,
      canAdjust: true,
      canReverse: false,
      canRetryTransfer: false,
    });
    expect(paid).toMatchObject({ canMarkPaid: false, canAdjust: false, canReverse: true });
    expect(failed).toMatchObject({
      canMarkPaid: false,
      canAdjust: false,
      canReverse: false,
      canRetryTransfer: true,
    });
    expect(toPayoutsStaffRows([row], new Map())[0]?.seller).toBe("Seller 11111111");
  });

  it("builds list links that drop one-off params and restart paging", () => {
    const search = { status: "paid", offset: "50", success: "Done", payout: "p1" };
    expect(payoutsListHref(search, { status: "failed" })).toBe("/admin/payouts?status=failed");
    expect(payoutsListHref(search, { offset: 100 })).toBe("/admin/payouts?status=paid&offset=100");
    expect(payoutPanelHref(search, "p2")).toBe("/admin/payouts?status=paid&offset=50&payout=p2");
    expect(payoutPanelHref(search, null)).toBe("/admin/payouts?status=paid&offset=50");
  });

  it("offers a view for every payout status and knows which one is active", () => {
    expect(payoutsViews({}).map((view) => view.label)).toEqual([
      "All",
      "Scheduled",
      "In transit",
      "Paid",
      "Failed",
      "Reversed",
      "Clawback pending",
    ]);
    expect(payoutsViews({ status: "paid" })[0]?.href).toBe("/admin/payouts");
    expect(activePayoutsView({ status: "failed" })).toBe("failed");
    expect(activePayoutsView({ status: "nonsense" })).toBe("all");
  });

  it("lists the waiting work, each linking to where it is handled", () => {
    const items = payoutsAttention({}, summary, 2);
    expect(items.map((item) => [item.count, item.label, item.href])).toEqual([
      [3, "payouts failed", "/admin/payouts?status=failed"],
      [1, "payout needs funds recovered", "/admin/payouts?status=clawback_pending"],
      [4, "payouts have settlement blockers", "/admin/payouts/settlement"],
      [2, "disputes are open", "/admin/disputes"],
    ]);
  });

  it("summarises the matching payouts in four numbers", () => {
    expect(payoutsMetrics(summary).map((metric) => [metric.label, metric.value])).toEqual([
      ["Scheduled", "10"],
      ["In transit", "5"],
      ["Net payable", "£1,234.50"],
      ["Failed or clawback", "4"],
    ]);
  });

  it("shows the seller filter as a chip that removes only itself", () => {
    const search = { status: "paid", legalEntityId: "seller_1" };
    expect(payoutsFilterChips(search, "Gallery One")).toEqual([
      {
        id: "legalEntityId",
        label: "Seller: Gallery One",
        clearHref: "/admin/payouts?status=paid",
      },
    ]);
    expect(payoutsFilterChips({ status: "paid" }, null)).toEqual([]);
  });

  it("reads a signed amount in pounds", () => {
    expect(parseSignedPounds("-25")).toEqual({ ok: true, pence: -2500, amount: "-25.00" });
    expect(parseSignedPounds("−25.5")).toEqual({ ok: true, pence: -2550, amount: "-25.50" });
    expect(parseSignedPounds("£1,040.05")).toEqual({ ok: true, pence: 104_005, amount: "1040.05" });
    expect(parseSignedPounds("0")).toEqual({ ok: false });
    expect(parseSignedPounds("1.234")).toEqual({ ok: false });
    expect(parseSignedPounds("abc")).toEqual({ ok: false });
  });

  it("states the range with the total", () => {
    expect(payoutsRangeSummary(0, 50, 312)).toBe("1–50 of 312 payouts");
    expect(payoutsRangeSummary(0, 1, 1)).toBe("1–1 of 1 payout");
  });
});

describe("payoutPeriod", () => {
  it("shows both ends of a bounded period", () => {
    expect(payoutPeriod("2026-10-01T00:00:00.000Z", "2026-10-31T00:00:00.000Z")).toBe(
      "1 Oct 2026 – 31 Oct 2026",
    );
  });

  it("reads an epoch start as everything up to the end date", () => {
    expect(payoutPeriod("1970-01-01T00:00:00.000Z", "2026-06-22T00:00:00.000Z")).toBe(
      "Up to 22 Jun 2026",
    );
  });
});
