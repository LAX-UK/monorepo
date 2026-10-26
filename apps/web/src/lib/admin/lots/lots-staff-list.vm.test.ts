import type { AdminLotTableRow } from "@/lib/admin/catalog/lot-table-row";
import { lotLensHref } from "@/lib/admin/catalog/lots-lenses";
import { EMPTY_ADMIN_LOTS_LIST_SUMMARY } from "@/lib/data/http/admin-lots-summary.server";
import { type AtgLotSellingSummary, toAtgSaleSellingSummary } from "@auction/types";
import { describe, expect, it } from "vitest";
import {
  LOTS_DEFAULT_SORT,
  lotPanelHref,
  lotsAttention,
  lotsFilterChips,
  lotsMetrics,
  lotsMetricsPeriod,
  lotsRangeSummary,
  lotsSortHref,
  lotsSortState,
  toLotsStaffRows,
} from "./lots-staff-list.vm";

const row: AdminLotTableRow = {
  id: "lot_1",
  title: "Blue Interior",
  lotNumber: 12,
  thumbnailUrl: null,
  estimateDisplay: { primary: "—" },
  imageCount: 0,
  artistLabel: "Ada Lovelace",
  saleId: "sale_1",
  saleTitle: "Autumn Contemporary",
  saleStatus: "draft",
  saleDeliveryMode: "online",
  auctionType: "english",
  status: "ended",
  endTimeIso: "2026-10-20T18:00:00.000Z",
  endTimeLabel: "",
  hammerDisplay: { primary: "£4,200.00" },
  canDelete: false,
  hasWinner: true,
  createdAtIso: "2026-09-01T09:00:00.000Z",
};

describe("lots staff list view model", () => {
  it("reads an ended lot with a winner as sold, and leaves empty money empty", () => {
    const [lot] = toLotsStaffRows([row], { lot_1: "2026-10-21T10:00:00.000Z" });
    expect(lot?.status).toEqual({ label: "Sold", tone: "success" });
    expect(lot?.estimate).toBeNull();
    expect(lot?.hammer).toBe("£4,200.00");
    expect(lot?.context).toBe("Lot 12 · Ada Lovelace");
    expect(lot?.inDraftSale).toBe(true);
    expect(lot?.withdrawalRequestedAt).toBe("2026-10-21T10:00:00.000Z");
  });

  it("marks lots listed on ATG, but not lots whose sale sells on lax.bid", () => {
    const sale = (saleStatus: "draft" | "scheduled", atgLinked: boolean) =>
      toAtgSaleSellingSummary({
        saleStatus,
        atgRemoteStatus: atgLinked ? "published" : null,
        atgLinked,
        atgSoldLotCount: 0,
        atgApprovedAt: null,
      });
    const lotOnAtg = { remoteStatus: "1", lastError: null, sold: null, numberOfBids: 0 };
    const rows = ["lot_atg", "lot_lax", "lot_unpushed"].map((id) => ({ ...row, id }));
    const [onAtg, lax, unpushed] = toLotsStaffRows(
      rows,
      {},
      new Map<string, AtgLotSellingSummary>([
        ["lot_atg", { saleId: "sale_1", sale: sale("draft", true), lot: lotOnAtg }],
        ["lot_lax", { saleId: "sale_1", sale: sale("scheduled", false), lot: lotOnAtg }],
        ["lot_unpushed", { saleId: "sale_1", sale: sale("draft", true), lot: null }],
      ]),
    );
    expect(onAtg?.onAtg).toBe(true);
    expect(lax?.onAtg).toBeUndefined();
    expect(unpushed?.onAtg).toBeUndefined();
  });

  it("links the waiting work to the views that hold it, in plain words", () => {
    const [withdrawals, photos] = lotsAttention(
      {},
      { withdrawalsPending: 1, draftsMissingPhotos: 3 },
    );
    expect(withdrawals?.label).toBe("seller has asked to withdraw a lot");
    expect(withdrawals?.href).toBe("/admin/lots?lens=withdrawals");
    expect(photos?.label).toBe("draft lots have no photos");
  });

  it("formats the hammer total in full", () => {
    const metrics = lotsMetrics({ ...EMPTY_ADMIN_LOTS_LIST_SUMMARY, totalHammerValue: "1604812" });
    expect(metrics.find((metric) => metric.id === "hammer")?.value).toBe("£1,604,812.00");
  });

  it("links each count to its view, marks waiting work and trends every number when loaded", () => {
    const summary = { ...EMPTY_ADMIN_LOTS_LIST_SUMMARY, liveCount: 4, endingSoonCount: 2 };
    const bundle = (dailyCounts: number[], priorTotal: number) => ({
      currentTotal: dailyCounts.reduce((a, b) => a + b, 0),
      priorTotal,
      dailyCounts,
    });
    const trends = {
      live: bundle([3, 4, 4], 10),
      ended: bundle([1, 0, 2], 3),
      added: bundle([2, 2, 1], 10),
      hammer: bundle([0, 30, 100], 100),
    };
    const metrics = lotsMetrics(summary, trends);
    const byId = Object.fromEntries(metrics.map((metric) => [metric.id, metric]));
    // The same links as the view tabs.
    expect(byId.live).toMatchObject({ tone: "positive", href: lotLensHref("live", {}) });
    expect(byId.ending).toMatchObject({ tone: "attention", href: lotLensHref("ending", {}) });
    expect(byId.draft?.href).toBe(lotLensHref("draft", {}));
    expect(byId.live?.trend).toEqual([3, 4, 4]);
    expect(byId.live?.trendLabel).toBe("Lots open for bidding each day, last 3 days");
    expect(byId.ending?.trend).toEqual([1, 0, 2]);
    expect(byId.ending?.comparison).toMatchObject({ direction: "flat", tone: "neutral" });
    expect(byId.draft?.comparison).toMatchObject({ direction: "down", tone: "negative" });
    expect(byId.hammer?.trend).toEqual([0, 30, 100]);
    expect(byId.hammer?.comparison).toEqual({
      text: "30%",
      direction: "up",
      tone: "positive",
      basis: "hammer of lots ended each day, vs previous 3 days",
    });
    expect(lotsMetricsPeriod(trends)).toBe("All lots · daily trends over the last 3 days");

    // Without trends there is no chart, no change and no window in the period line.
    const plain = lotsMetrics(summary, { hammer: null });
    expect(plain.every((metric) => metric.trend === undefined)).toBe(true);
    expect(lotsMetricsPeriod({})).toBe("All lots");
  });

  it("keeps the search as a chip but never repeats the sort", () => {
    const chips = lotsFilterChips([
      { id: "q", label: "Search: blue", clearHref: "/admin/lots" },
      { id: "sort", label: "Sort: Ending soon", clearHref: "/admin/lots" },
      { id: "saleId", label: "Sale: Autumn Contemporary", clearHref: "/admin/lots" },
    ]);
    expect(chips.map((chip) => chip.id)).toEqual(["q", "saleId"]);
  });

  it("always shows a sorted column, newest first by default", () => {
    expect(lotsSortState(undefined)).toEqual(LOTS_DEFAULT_SORT);
    expect(lotsSortState("endingAsc")).toEqual({ columnId: "ends", direction: "asc" });
    expect(lotsSortHref({ sort: "hammerDesc" }, LOTS_DEFAULT_SORT)).toBe("/admin/lots");
  });

  it("opens a lot's panel in the URL without losing the page", () => {
    expect(lotPanelHref({ offset: "50" }, "lot_1")).toBe("/admin/lots?offset=50&lot=lot_1");
  });

  it("counts the range with plural forms", () => {
    expect(lotsRangeSummary(0, 1, 1)).toBe("1–1 of 1 lot");
    expect(lotsRangeSummary(50, 50, 1204)).toBe("51–100 of 1,204 lots");
    expect(lotsRangeSummary(0, 50, undefined)).toBe("1–50 lots");
  });
});
