import type { BidWithLot } from "@/lib/data/dto/dashboard-dtos";
import { portfolioSettlementLabel } from "@/lib/portfolio-settlement";
import { lotPath } from "@/lib/seo/url";
import type { PortfolioRow, UserNotification } from "@auction/types";

export type ActivityTone = "neutral" | "positive" | "negative" | "warning" | "info";

export type ActivityKind =
  | "outbid"
  | "won"
  | "lost"
  | "payment-due"
  | "payment-received"
  | "shipping"
  | "kyc"
  | "system"
  | "info";

export type ActivityItem = {
  id: string;
  kind: ActivityKind;
  tone: ActivityTone;
  title: string;
  description?: string;
  href?: string;
  /** ISO timestamp; used for sort and `<time dateTime>`. */
  at: string;
};

const PAYMENT_KIND_KEYWORDS = ["payment", "invoice", "settlement", "checkout"];
const OUTBID_KEYWORDS = ["outbid"];
const WON_KEYWORDS = ["won", "you won", "hammer"];
const LOST_KEYWORDS = ["lost", "did not win"];
const SHIPPING_KEYWORDS = ["ship", "delivery", "collection"];
const KYC_KEYWORDS = ["identity", "kyc", "verification"];

function classifyNotification(n: UserNotification): {
  kind: ActivityKind;
  tone: ActivityTone;
} {
  const haystack = `${n.type} ${n.title} ${n.message}`.toLowerCase();
  if (OUTBID_KEYWORDS.some((k) => haystack.includes(k))) {
    return { kind: "outbid", tone: "negative" };
  }
  if (PAYMENT_KIND_KEYWORDS.some((k) => haystack.includes(k))) {
    return { kind: "payment-received", tone: "info" };
  }
  if (WON_KEYWORDS.some((k) => haystack.includes(k))) {
    return { kind: "won", tone: "positive" };
  }
  if (LOST_KEYWORDS.some((k) => haystack.includes(k))) {
    return { kind: "lost", tone: "neutral" };
  }
  if (SHIPPING_KEYWORDS.some((k) => haystack.includes(k))) {
    return { kind: "shipping", tone: "info" };
  }
  if (KYC_KEYWORDS.some((k) => haystack.includes(k))) {
    return { kind: "kyc", tone: "warning" };
  }
  return { kind: "info", tone: "neutral" };
}

/** Build the unified activity stream for the dashboard overview.
 *
 * Sources of truth:
 * - Notifications (system-authored events: outbid, won, payment, KYC, etc.)
 * - Won lots (`PortfolioRow`) — adds a "payment due" item for unsettled wins
 *   when the notification stream has not yet surfaced one.
 * - Recent bids — used only when notifications are empty as a basic fallback
 *   so the feed never looks dead for active bidders.
 */
export function buildDashboardActivityVm(input: {
  notifications: readonly UserNotification[];
  portfolio: readonly PortfolioRow[];
  bidRows: readonly BidWithLot[];
  limit?: number;
}): ActivityItem[] {
  const { notifications, portfolio, bidRows, limit = 12 } = input;

  const items: ActivityItem[] = [];

  for (const n of notifications) {
    const { kind, tone } = classifyNotification(n);
    const base: ActivityItem = {
      id: `notif-${n.id}`,
      kind,
      tone,
      title: n.title,
      description: n.message,
      at: n.createdAt.toISOString(),
    };
    items.push(n.lotId ? { ...base, href: `/dashboard/bids#${n.lotId}` } : base);
  }

  // Settlement items derived from the portfolio. Surfaced even when no
  // notification yet exists for the win/payment.
  const settlementLotIds = new Set<string>();
  for (const row of portfolio) {
    if (row.lot.status !== "ended") continue;
    const label = portfolioSettlementLabel(row);
    if (label === "Paid" || label === "Refunded") continue;
    settlementLotIds.add(row.lot.id);
    items.push({
      id: `settle-${row.lot.id}`,
      kind: "payment-due",
      tone: "warning",
      title: `Payment due: ${row.lot.title}`,
      description: label,
      href: `/dashboard/checkout/${row.lot.id}`,
      at: row.lot.endTime.toISOString(),
    });
  }

  if (notifications.length === 0) {
    // Fall back to recent bid activity so brand-new users see something useful.
    const seen = new Set<string>();
    for (const row of bidRows) {
      if (!row.lot) continue;
      if (seen.has(row.bid.lotId)) continue;
      seen.add(row.bid.lotId);
      items.push({
        id: `bid-${row.bid.id}`,
        kind: row.lot.status === "ended" ? "lost" : "info",
        tone: row.lot.status === "ended" ? "neutral" : "info",
        title: `Bid placed on ${row.lot.title}`,
        description: `Your bid: ${row.bid.amount}`,
        href: lotPath(row.lot),
        at: row.bid.createdAt.toISOString(),
      });
    }
  }

  // Sort descending, then dedupe (notifications win over derived items when ids
  // collide on the same lot via different sources).
  items.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
  return items.slice(0, limit);
}
