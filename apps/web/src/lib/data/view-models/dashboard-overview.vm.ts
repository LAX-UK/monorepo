import type {
  ArtistFollowRow,
  BidWithLot,
  WatchlistWithLotRow,
} from "@/lib/data/http/dashboard.server";
import { portfolioSettlementLabel } from "@/lib/portfolio-settlement";
import type { Lot } from "@auction/types";
import type { PortfolioRow } from "@auction/types";

export type DashboardOverviewErrors = {
  active: string | null;
  portfolio: string | null;
  watchlist: string | null;
  artistFollow: string | null;
  bids: string | null;
};

export type DashboardOverviewVm = {
  firstName: string;
  userId: string;
  userRole: string | undefined;
  errors: DashboardOverviewErrors;
  kpi: {
    portfolioValueFormatted: string;
    wonThisYear: number;
    winRatePercent: number | null;
    engagementLabel: string;
    activeBidsCount: number;
    /** Normalized 0–1 points for sparklines (placeholder when no history) */
    trend: readonly number[];
  };
  activeLots: Lot[];
  activeLotBidHints: Record<string, "high" | "outbid" | "none">;
  wonLotsSidebar: PortfolioRow[];
  watchPreview: WatchlistWithLotRow[];
  artistFollowPreview: ArtistFollowRow[];
  settlementsDue: PortfolioRow[];
  liveCount: number;
  acquiredCount: number;
  /** Smart primary action for hero CTA */
  primaryCta: { label: string; href: string } | null;
};

function stubTrend(seed: number): readonly number[] {
  const out: number[] = [];
  for (let i = 0; i < 7; i += 1) {
    out.push(0.35 + 0.08 * Math.sin(seed * 0.7 + i * 0.9) + i * 0.02);
  }
  return out.map((v) => Math.min(1, Math.max(0, v)));
}

export function buildDashboardOverviewVm(input: {
  user: { id: string; name: string; role?: string } | null;
  activeLots: Lot[];
  portfolio: PortfolioRow[];
  watchlist: WatchlistWithLotRow[];
  artistFollow: ArtistFollowRow[];
  bidRows: BidWithLot[];
  errors: DashboardOverviewErrors;
  formatMoney: (amount: string) => string;
}): DashboardOverviewVm {
  const { user, activeLots, portfolio, watchlist, artistFollow, bidRows, errors, formatMoney } =
    input;
  const firstName = user?.name?.split(/\s+/)[0] ?? "curator";
  const totalSpent = portfolio.reduce(
    (sum, row) => sum + Number.parseFloat(row.lot.currentPrice),
    0,
  );
  const yearUtc = new Date().getUTCFullYear();
  const wonThisYear = portfolio.filter(
    (row) => row.lot.endTime.getUTCFullYear() === yearUtc,
  ).length;

  let wins = 0;
  let losses = 0;
  if (user) {
    const seen = new Set<string>();
    for (const row of bidRows) {
      const a = row.lot;
      if (!a || a.status !== "ended" || seen.has(a.id)) continue;
      seen.add(a.id);
      if (a.winnerId === user.id) wins += 1;
      else losses += 1;
    }
  }
  const decided = wins + losses;
  const winRate = decided > 0 ? Math.round((wins / decided) * 100) : null;
  const engagementLabel =
    decided > 0 ? `${wins} win${wins === 1 ? "" : "s"} / ${decided} decided` : "—";

  const latestByLot = new Map<string, BidWithLot>();
  for (const row of bidRows) {
    const prev = latestByLot.get(row.bid.lotId);
    if (!prev || row.bid.createdAt > prev.bid.createdAt) {
      latestByLot.set(row.bid.lotId, row);
    }
  }
  const activeBidsCount = [...latestByLot.values()].filter(
    (r) => r.lot?.status === "active",
  ).length;

  const activeLotBidHints: Record<string, "high" | "outbid" | "none"> = {};
  if (user) {
    const latest = new Map<string, BidWithLot>();
    for (const row of bidRows) {
      const lid = row.bid.lotId;
      const prev = latest.get(lid);
      if (!prev || row.bid.createdAt > prev.bid.createdAt) latest.set(lid, row);
    }
    for (const lot of activeLots) {
      const row = latest.get(lot.id);
      if (!row?.lot || row.lot.status !== "active") {
        activeLotBidHints[lot.id] = "none";
        continue;
      }
      const yours = Number.parseFloat(row.bid.amount);
      const current = Number.parseFloat(lot.currentPrice);
      activeLotBidHints[lot.id] = yours >= current ? "high" : "outbid";
    }
  }

  const wonLotsSidebar = portfolio.filter((row) => row.lot.status === "ended").slice(0, 4);
  const watchPreview = watchlist.filter((w) => w.lot).slice(0, 4);
  const artistFollowPreview = artistFollow.slice(0, 8);
  const settlementsDue = portfolio.filter((row) => {
    if (row.lot.status !== "ended") return false;
    return portfolioSettlementLabel(row) !== "Paid";
  });

  let primaryCta: { label: string; href: string } | null = null;
  const firstSettlement = settlementsDue[0];
  if (firstSettlement) {
    primaryCta = {
      label: `Pay for “${firstSettlement.lot.title}”`,
      href: `/dashboard/checkout/${firstSettlement.lot.id}`,
    };
  } else {
    const outbidLot = activeLots.find((lot) => activeLotBidHints[lot.id] === "outbid");
    if (outbidLot) {
      primaryCta = {
        label: `Re-bid on “${outbidLot.title}”`,
        href: `/artwork/${outbidLot.id}`,
      };
    } else {
      const w = watchlist.find((x) => x.lot && x.lot.status === "active")?.lot;
      if (w) {
        primaryCta = { label: `Lot ending: “${w.title}”`, href: `/artwork/${w.id}` };
      } else {
        primaryCta = { label: "Start a submission", href: "/dashboard/submissions/new" };
      }
    }
  }

  return {
    firstName,
    userId: user?.id ?? "",
    userRole: user?.role,
    errors,
    kpi: {
      portfolioValueFormatted: formatMoney(totalSpent.toFixed(2)),
      wonThisYear,
      winRatePercent: winRate,
      engagementLabel,
      activeBidsCount,
      trend: stubTrend(totalSpent),
    },
    activeLots,
    activeLotBidHints,
    wonLotsSidebar,
    watchPreview,
    artistFollowPreview,
    settlementsDue,
    liveCount: activeLots.length,
    acquiredCount: portfolio.length,
    primaryCta,
  };
}
