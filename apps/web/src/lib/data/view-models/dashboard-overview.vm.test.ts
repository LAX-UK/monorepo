import { dashboardSofRequirementsUrl } from "@/lib/dashboard/dashboard-copy";
import type { WatchlistWithLotRow } from "@/lib/data/dto/dashboard-dtos";
import type { Lot, PortfolioRow } from "@auction/types";
import { describe, expect, it } from "vitest";
import { buildDashboardOverviewVm } from "./dashboard-overview.vm";

const emptyErrors = {
  session: null,
  active: null,
  portfolio: null,
  watchlist: null,
  artistFollow: null,
  bids: null,
  submissions: null,
  notifications: null,
  addresses: null,
};

describe("buildDashboardOverviewVm", () => {
  it("uses a friendly default when user is missing", () => {
    const vm = buildDashboardOverviewVm({
      user: null,
      activeLots: [],
      portfolio: [],
      watchlist: [],
      artistFollow: [],
      bidRows: [],
      errors: emptyErrors,
      formatMoney: (s) => `£${s}`,
    });
    expect(vm.firstName).toBe("curator");
    expect(vm.kpi.activeBidsCount).toBe(0);
  });

  it("takes first name from user display name", () => {
    const vm = buildDashboardOverviewVm({
      user: { id: "u1", name: "Ada Lovelace", role: "client" },
      activeLots: [],
      portfolio: [],
      watchlist: [],
      artistFollow: [],
      bidRows: [],
      errors: emptyErrors,
      formatMoney: (s) => `£${s}`,
    });
    expect(vm.firstName).toBe("Ada");
  });

  it("uses injected now for ending-soon watchlist window", () => {
    const far = new Date("2030-01-15T12:00:00.000Z");
    const vm = buildDashboardOverviewVm({
      user: { id: "u1", name: "Test", role: "client" },
      activeLots: [],
      portfolio: [],
      watchlist: [
        {
          watchlistId: "w1",
          lotId: "l1",
          createdAt: new Date(),
          lot: {
            id: "l1",
            title: "Lot",
            status: "active",
            endTime: new Date("2030-01-15T18:00:00.000Z"),
          } as unknown as Lot,
        } satisfies WatchlistWithLotRow,
      ],
      artistFollow: [],
      bidRows: [],
      errors: emptyErrors,
      formatMoney: (s) => `£${s}`,
      now: far,
    });
    expect(vm.endingSoonWatchlist).toHaveLength(1);
  });

  it("primary CTA points to SoF requirements when settlement is compliance-held", () => {
    const portfolio = [
      {
        lot: { id: "l-sof", title: "Held lot", status: "ended", endTime: new Date() },
        payment: { status: "pending", manualReviewReason: "source_of_funds_required" },
      },
    ] as PortfolioRow[];
    const vm = buildDashboardOverviewVm({
      user: { id: "u1", name: "Test", role: "client" },
      activeLots: [],
      portfolio,
      watchlist: [],
      artistFollow: [],
      bidRows: [],
      errors: emptyErrors,
      formatMoney: (s) => `£${s}`,
    });
    expect(vm.primaryCta).toEqual({
      label: "View source of funds requirements",
      href: dashboardSofRequirementsUrl(),
    });
  });

  it("builds activeBidLots from user bids even when lot is outside global preview", () => {
    const endEarly = new Date("2026-06-18T12:00:00.000Z");
    const endLate = new Date("2026-06-19T12:00:00.000Z");
    const saleroomLot = {
      id: "saleroom-lot",
      lotNumber: 3,
      title: "ROLEX Pearlmaster",
      status: "active",
      currentPrice: "1700.00",
      endTime: endLate,
      startTime: new Date("2026-06-17T10:00:00.000Z"),
    } as unknown as Lot;
    const previewLot = {
      id: "preview-lot",
      lotNumber: 1,
      title: "Preview lot",
      status: "active",
      currentPrice: "500.00",
      endTime: endEarly,
      startTime: new Date("2026-06-17T10:00:00.000Z"),
    } as unknown as Lot;
    const bidRows = [
      {
        bid: {
          id: "bid-saleroom",
          lotId: saleroomLot.id,
          amount: "1700.00",
          isWinning: true,
          isAutoBid: false,
          maxAutoBidAmount: null,
          placedVia: "saleroom",
          clerkUserId: "clerk-1",
          createdAt: new Date("2026-06-18T08:00:00.000Z"),
        },
        lot: saleroomLot,
      },
      {
        bid: {
          id: "bid-outbid",
          lotId: previewLot.id,
          amount: "400.00",
          isWinning: false,
          isAutoBid: false,
          maxAutoBidAmount: null,
          placedVia: "web",
          clerkUserId: null,
          createdAt: new Date("2026-06-18T09:00:00.000Z"),
        },
        lot: previewLot,
      },
    ];

    const vm = buildDashboardOverviewVm({
      user: { id: "buyer-1", name: "Test", role: "client" },
      activeLots: [previewLot],
      portfolio: [],
      watchlist: [],
      artistFollow: [],
      bidRows,
      errors: emptyErrors,
      formatMoney: (s) => `£${s}`,
    });

    expect(vm.activeBidLots.map((e) => e.lot.id)).toEqual(["preview-lot", "saleroom-lot"]);
    expect(vm.activeBidLots[0]?.hint).toBe("outbid");
    expect(vm.activeBidLots[1]?.hint).toBe("high");
    expect(vm.kpi.activeBidsCount).toBe(2);
    expect(vm.outbidCount).toBe(1);
    expect(vm.primaryCta).toEqual({
      label: "Re-bid on “Preview lot”",
      href: expect.stringContaining("preview-lot"),
    });
  });
});
