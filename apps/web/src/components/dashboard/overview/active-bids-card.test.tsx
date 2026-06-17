import { ActiveBidsCard } from "@/components/dashboard/overview/active-bids-card";
import type { DashboardOverviewVm } from "@/lib/data/view-models/dashboard-overview.vm";
import type { Bid, Lot } from "@auction/types";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

function vmWithActiveBidLots(entries: DashboardOverviewVm["activeBidLots"]): DashboardOverviewVm {
  return {
    firstName: "Ada",
    userId: "u1",
    userRole: "client",
    errors: {
      session: null,
      active: null,
      portfolio: null,
      watchlist: null,
      artistFollow: null,
      bids: null,
      submissions: null,
      notifications: null,
      addresses: null,
    },
    kpi: {
      portfolioValueFormatted: "£0.00",
      wonThisYear: 0,
      winRatePercent: null,
      engagementLabel: "—",
      activeBidsCount: entries.length,
    },
    activeLots: [],
    activeLotBidHints: {},
    activeBidLots: entries,
    wonLotsSidebar: [],
    watchPreview: [],
    watchlistTotalCount: 0,
    endingSoonWatchlist: [],
    artistFollowPreview: [],
    artistFollowTotalCount: 0,
    settlementsDue: [],
    submissionsCount: 0,
    liveLotsPreviewCount: 0,
    outbidCount: 0,
    acquiredCount: 0,
    primaryCta: null,
  };
}

describe("ActiveBidsCard", () => {
  it("renders user active bids outside the global preview with on-behalf badge", () => {
    const lot = {
      id: "saleroom-lot",
      lotNumber: 3,
      title: "ROLEX Pearlmaster",
      medium: "Watch",
      images: [],
      currentPrice: "1700.00",
      status: "active",
      startTime: new Date("2026-06-17T10:00:00.000Z"),
      endTime: new Date("2026-06-18T22:00:00.000Z"),
    } as unknown as Lot;
    const bid = {
      id: "bid-1",
      lotId: lot.id,
      amount: "1700.00",
      isWinning: true,
      isAutoBid: false,
      maxAutoBidAmount: null,
      placedVia: "saleroom",
      clerkUserId: "clerk-1",
      createdAt: new Date(),
    } as Bid;

    render(
      <ActiveBidsCard
        vm={vmWithActiveBidLots([
          {
            lot,
            bid,
            hint: "high",
          },
        ])}
      />,
    );

    expect(screen.getByText("ROLEX Pearlmaster")).toBeInTheDocument();
    expect(screen.getByText(/Bid placed for you · Floor/i)).toBeInTheDocument();
    expect(screen.getByText(/My bid/i)).toBeInTheDocument();
  });
});
