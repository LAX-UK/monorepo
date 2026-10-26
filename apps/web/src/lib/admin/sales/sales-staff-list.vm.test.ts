import type { AdminSaleBoardRow } from "@/lib/admin/catalog/sale-table-row";
import { EMPTY_ADMIN_SALES_LIST_SUMMARY } from "@/lib/data/http/admin-sales-summary.server";
import { type AtgSaleSellingSummary, toAtgSaleSellingSummary } from "@auction/types";
import { describe, expect, it } from "vitest";
import {
  SALES_DEFAULT_SORT,
  lotCountLabel,
  salePanelHref,
  salesAttention,
  salesFilterChips,
  salesMetrics,
  salesRangeSummary,
  salesSortHref,
  salesSortState,
  toSalesStaffRows,
} from "./sales-staff-list.vm";

const row: AdminSaleBoardRow = {
  saleId: "sale_1",
  title: "Autumn Contemporary",
  status: "scheduled",
  lotCount: 1,
  coverImageUrl: null,
  deliveryMode: "hybrid",
  typeLabel: "Hybrid",
  startTimeIso: "2026-11-12T18:00:00.000Z",
  startTimeLabel: "",
  endTimeIso: "2026-11-12T21:00:00.000Z",
  endTimeLabel: "",
  sparklineValues: [],
  canDelete: false,
  createdAtIso: "2026-10-01T09:00:00.000Z",
};

describe("sales staff list view model", () => {
  it("names how the sale is sold and counts its lots in words", () => {
    const [sale] = toSalesStaffRows([row]);
    expect(sale?.status).toEqual({ label: "Scheduled", tone: "info" });
    expect(sale?.context).toBe("Hybrid · 1 lot");
    expect(sale?.saleroom).toBe(true);
    expect(sale?.editHref).toBe("/admin/sales/sale_1/edit");
    expect(lotCountLabel(0)).toBe("No lots yet");
    expect(lotCountLabel(1204)).toBe("1,204 lots");
  });

  it("marks draft sales linked to ATG and disables lax.bid actions only when ATG owns them", () => {
    const summary = (remoteStatus: "created" | "published"): AtgSaleSellingSummary =>
      toAtgSaleSellingSummary({
        saleStatus: "draft",
        atgRemoteStatus: remoteStatus,
        atgLinked: true,
        atgSoldLotCount: 0,
        atgApprovedAt: null,
      });
    const drafts = ["s_draft", "s_live", "s_free"].map((saleId) => ({
      ...row,
      saleId,
      status: "draft" as const,
    }));
    const [onAtgDraft, live, free] = toSalesStaffRows(
      drafts,
      new Map([
        ["s_draft", summary("created")],
        ["s_live", summary("published")],
      ]),
    );
    expect(onAtgDraft).toMatchObject({ onAtg: true });
    expect(onAtgDraft?.sellingOnAtg).toBeUndefined();
    expect(live).toMatchObject({ onAtg: true, sellingOnAtg: true });
    expect(free?.onAtg).toBeUndefined();
    expect(toSalesStaffRows([row])[0]?.onAtg).toBeUndefined();
  });

  it("points the setup work at the setup view", () => {
    const [setup] = salesAttention(
      {},
      {
        ...EMPTY_ADMIN_SALES_LIST_SUMMARY,
        lensCounts: { ...EMPTY_ADMIN_SALES_LIST_SUMMARY.lensCounts, setup: 2 },
      },
    );
    expect(setup?.count).toBe(2);
    expect(setup?.label).toBe("draft sales need setting up");
    expect(setup?.href).toBe("/admin/sales?lens=setup&status=draft");
  });

  it("formats the hammer total in full", () => {
    const metrics = salesMetrics({ ...EMPTY_ADMIN_SALES_LIST_SUMMARY, totalHammerValue: "62500" });
    expect(metrics.find((metric) => metric.id === "hammer")?.value).toBe("£62,500.00");
  });

  it("leaves the search, sort and lifecycle to their own controls", () => {
    const chips = salesFilterChips([
      { id: "q", label: "Search: autumn", clearHref: "/admin/sales" },
      { id: "lifecycle", label: "Lifecycle: Live", clearHref: "/admin/sales" },
      { id: "deliveryMode", label: "Delivery: Onsite", clearHref: "/admin/sales" },
    ]);
    expect(chips.map((chip) => chip.id)).toEqual(["deliveryMode"]);
  });

  it("always shows a sorted column", () => {
    expect(salesSortState(undefined)).toEqual(SALES_DEFAULT_SORT);
    expect(salesSortHref({}, { columnId: "starts", direction: "asc" })).toBe(
      "/admin/sales?sort=startAsc",
    );
    expect(salePanelHref({}, "sale_1")).toBe("/admin/sales?sale=sale_1");
    expect(salesRangeSummary(0, 12, 12)).toBe("1–12 of 12 sales");
  });
});
