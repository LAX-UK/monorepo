import { dashboardCheckoutLotUrl } from "@/lib/dashboard/dashboard-copy";
import type {
  ArtistFollowRow,
  BidWithLot,
  WatchlistWithLotRow,
} from "@/lib/data/dto/dashboard-dtos";
import { portfolioSettlementLabel } from "@/lib/portfolio-settlement";
import { lotPath } from "@/lib/seo/url";
import type { Lot } from "@auction/types";
import type { PortfolioRow } from "@auction/types";
import { portfolioRowTotalMajorUnits } from "./lot-pricing-helpers";

export type DashboardOverviewErrors = {
  session: string | null;
  active: string | null;
  portfolio: string | null;
  watchlist: string | null;
  artistFollow: string | null;
  bids: string | null;
  submissions: string | null;
  notifications: string | null;
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
  };
  activeLots: Lot[];
  activeLotBidHints: Record<string, "high" | "outbid" | "none">;
  wonLotsSidebar: PortfolioRow[];
  watchPreview: WatchlistWithLotRow[];
  /** Full watchlist size (not just preview). */
  watchlistTotalCount: number;
  /** Active watchlist lots whose endTime falls within the next 24h. */
  endingSoonWatchlist: WatchlistWithLotRow[];
  artistFollowPreview: ArtistFollowRow[];
  artistFollowTotalCount: number;
  settlementsDue: PortfolioRow[];
  submissionsCount: number;
  /** Number of preview lots returned (NOT a global total). */
  liveLotsPreviewCount: number;
  /** Number of active lots where the user has been outbid. */
  outbidCount: number;
  acquiredCount: number;
  /** Smart primary action for hero CTA */
  primaryCta: { label: string; href: string } | null;
};

const ENDING_SOON_MS = 24 * 60 * 60 * 1000;

export function buildDashboardOverviewVm(input: {
  user: { id: string; name: string; role?: string } | null;
  activeLots: Lot[];
  portfolio: PortfolioRow[];
  watchlist: WatchlistWithLotRow[];
  artistFollow: ArtistFollowRow[];
  submissionsCount?: number;
  bidRows: BidWithLot[];
  errors: DashboardOverviewErrors;
  formatMoney: (amount: string) => string;
  /** Fixed clock for tests and deterministic SSR snapshots. */
  now?: Date;
}): DashboardOverviewVm {
  const {
    user,
    activeLots,
    portfolio,
    watchlist,
    artistFollow,
    submissionsCount = 0,
    bidRows,
    errors,
    formatMoney,
    now: nowInput,
  } = input;
  const nowDate = nowInput ?? new Date();
  const firstName = user?.name?.split(/\s+/)[0] ?? "curator";
  const totalSpent = portfolio.reduce((sum, row) => sum + portfolioRowTotalMajorUnits(row), 0);
  const yearUtc = nowDate.getUTCFullYear();
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
  const watchlistTotalCount = watchlist.filter((w) => w.lot).length;
  const nowMs = nowDate.getTime();
  const endingSoonWatchlist = watchlist.filter((w) => {
    if (!w.lot || w.lot.status !== "active") return false;
    const ms = w.lot.endTime.getTime() - nowMs;
    return ms > 0 && ms <= ENDING_SOON_MS;
  });
  const artistFollowPreview = artistFollow.slice(0, 8);
  const settlementsDue = portfolio.filter((row) => {
    if (row.lot.status !== "ended") return false;
    return portfolioSettlementLabel(row) !== "Paid";
  });
  const outbidCount = activeLots.filter((lot) => activeLotBidHints[lot.id] === "outbid").length;

  let primaryCta: { label: string; href: string } | null = null;
  const firstSettlement = settlementsDue[0];
  if (firstSettlement) {
    primaryCta = {
      label: `Pay for “${firstSettlement.lot.title}”`,
      href: dashboardCheckoutLotUrl(firstSettlement.lot.id),
    };
  } else {
    const outbidLot = activeLots.find((lot) => activeLotBidHints[lot.id] === "outbid");
    if (outbidLot) {
      primaryCta = {
        label: `Re-bid on “${outbidLot.title}”`,
        href: lotPath(outbidLot),
      };
    } else {
      const w = watchlist.find((x) => x.lot && x.lot.status === "active")?.lot;
      if (w) {
        primaryCta = { label: `Lot ending: “${w.title}”`, href: lotPath(w) };
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
    },
    activeLots,
    activeLotBidHints,
    wonLotsSidebar,
    watchPreview,
    watchlistTotalCount,
    endingSoonWatchlist,
    artistFollowPreview,
    artistFollowTotalCount: artistFollow.length,
    settlementsDue,
    submissionsCount,
    liveLotsPreviewCount: activeLots.length,
    outbidCount,
    acquiredCount: portfolio.length,
    primaryCta,
  };
}
