import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
import {
  type LotForBrowseFallback,
  filterAndPaginateAttachableLots,
  isAttachableLot,
  mapLotToPickerRow,
  matchesBrowseState,
} from "@/lib/admin/lot-browse-fallback";

function lot(overrides: Partial<LotForBrowseFallback> = {}): LotForBrowseFallback {
  return {
    id: "lot-1",
    saleId: null,
    lotNumber: null,
    title: "Test lot",
    description: null,
    medium: null,
    dimensions: null,
    images: [],
    categoryId: "cat-1",
    auctionType: "english",
    startingPrice: "100",
    reservePrice: null,
    buyNowPrice: null,
    currentPrice: "100",
    buyerPremiumRate: "0.25",
    minBidIncrement: "10",
    dutchDecrementAmount: null,
    dutchDecrementIntervalMs: 0,
    dutchLastDecrementAt: null,
    startTime: new Date("2026-01-01T00:00:00.000Z"),
    endTime: new Date("2026-02-01T00:00:00.000Z"),
    status: "draft",
    winnerId: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    marketingDetails: {},
    ...overrides,
  };
}

describe("lot-browse-fallback", () => {
  describe("matchesBrowseState", () => {
    it("treats missing returnCount as available", () => {
      expect(matchesBrowseState(lot(), "available")).toBe(true);
      expect(matchesBrowseState(lot(), "returned")).toBe(false);
    });

    it("filters by returnCount for returned and available", () => {
      const returned = lot({
        lifecycleSummary: {
          lastEventType: "lot.returned",
          lastEventAt: "2026-01-01",
          returnCount: 2,
        },
      });
      expect(matchesBrowseState(returned, "returned")).toBe(true);
      expect(matchesBrowseState(returned, "available")).toBe(false);
      expect(matchesBrowseState(returned, "all")).toBe(true);
    });
  });

  describe("isAttachableLot", () => {
    it("requires draft, unattached, non-archived seller", () => {
      expect(isAttachableLot(lot(), { state: "all" })).toBe(true);
      expect(isAttachableLot(lot({ saleId: "sale-1" }), { state: "all" })).toBe(false);
      expect(isAttachableLot(lot({ archivedSeller: true }), { state: "all" })).toBe(false);
      expect(isAttachableLot(lot({ status: "scheduled" }), { state: "all" })).toBe(false);
    });

    it("filters by sellerLegalEntityId when provided", () => {
      expect(
        isAttachableLot(lot({ sellerLegalEntityId: "seller-a" }), {
          sellerLegalEntityId: "seller-a",
          state: "all",
        }),
      ).toBe(true);
      expect(
        isAttachableLot(lot({ sellerLegalEntityId: "seller-a" }), {
          sellerLegalEntityId: "seller-b",
          state: "all",
        }),
      ).toBe(false);
    });
  });

  describe("mapLotToPickerRow", () => {
    it("maps lifecycle kind from returnCount", () => {
      expect(mapLotToPickerRow(lot()).lifecycle.kind).toBe("new_draft");
      expect(
        mapLotToPickerRow(
          lot({
            lifecycleSummary: {
              lastEventType: "lot.returned",
              lastEventAt: "2026-01-01",
              returnCount: 1,
            },
          }),
        ).lifecycle.kind,
      ).toBe("returned");
    });
  });

  describe("filterAndPaginateAttachableLots", () => {
    it("paginates filtered attachable rows", () => {
      const lots: LotForBrowseFallback[] = [
        lot({ id: "a", title: "A" }),
        lot({ id: "b", title: "B", saleId: "sale-1" }),
        lot({
          id: "c",
          title: "C",
          lifecycleSummary: {
            lastEventType: "lot.returned",
            lastEventAt: "2026-01-01",
            returnCount: 1,
          },
        }),
      ];

      const page = filterAndPaginateAttachableLots(lots, {
        state: "available",
        limit: 1,
        offset: 0,
      });

      expect(page.total).toBe(1);
      expect(page.rows).toHaveLength(1);
      expect(page.rows[0]?.id).toBe("a");
    });
  });
});
