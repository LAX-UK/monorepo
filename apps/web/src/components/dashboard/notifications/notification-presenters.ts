import type { UserNotification } from "@auction/types";
import {
  BellRing,
  Clock,
  CreditCard,
  Eye,
  Gavel,
  type LucideIcon,
  Trophy,
  XCircle,
} from "lucide-react";

/** Visual tone for a notification type. Keep it small — Tailwind classes
 * applied at render time map directly to these values.
 */
export type NotificationTone = "neutral" | "info" | "success" | "warn" | "danger";

export type NotificationPresentation = {
  label: string;
  Icon: LucideIcon;
  tone: NotificationTone;
};

/** Pure mapper from a notification's `type` field to its presentation.
 *
 * Open for extension — adding a new `type` only requires appending a branch
 * here; consumers (row component, presenters) don't change.
 */
export function notificationTypePresenter(type: string): NotificationPresentation {
  if (type.startsWith("outbid")) {
    return { label: "Outbid", Icon: Gavel, tone: "warn" };
  }
  if (type === "lot_won") {
    return { label: "Won", Icon: Trophy, tone: "success" };
  }
  if (type === "lot_lost") {
    return { label: "Lost", Icon: XCircle, tone: "neutral" };
  }
  if (type === "payment_due" || type.startsWith("payment")) {
    return { label: "Payment", Icon: CreditCard, tone: "info" };
  }
  if (type === "ending_soon" || type === "lot_ending_soon") {
    return { label: "Ending soon", Icon: Clock, tone: "warn" };
  }
  if (type.startsWith("watchlist")) {
    return { label: "Watchlist", Icon: Eye, tone: "info" };
  }
  return { label: humanizeType(type), Icon: BellRing, tone: "neutral" };
}

function humanizeType(type: string): string {
  if (!type) return "Notification";
  const spaced = type.replace(/_/g, " ").trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** Compact "x ago" / fallback locale date string. Pure, side-effect free. */
export function relativeTime(date: Date, now: Date = new Date()): string {
  const diffMs = now.getTime() - date.getTime();
  if (!Number.isFinite(diffMs)) return "";
  if (diffMs < 0) return "just now";
  const seconds = Math.round(diffMs / 1000);
  if (seconds < 60) return `${Math.max(1, seconds)}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.round(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  return date.toLocaleDateString();
}

/** Date bands used to group rows in the inbox. Order is meaningful. */
export const DATE_BANDS = ["Today", "Yesterday", "This week", "Earlier"] as const;
export type DateBand = (typeof DATE_BANDS)[number];

/** Returns the band a given date belongs to, relative to `now`. Pure. */
export function dateBand(date: Date, now: Date = new Date()): DateBand {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "Earlier";
  const start = (d: Date) => {
    const c = new Date(d);
    c.setHours(0, 0, 0, 0);
    return c;
  };
  const today = start(now);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const weekFloor = new Date(today);
  weekFloor.setDate(weekFloor.getDate() - 7);

  const ts = date.getTime();
  if (ts >= today.getTime()) return "Today";
  if (ts >= yesterday.getTime()) return "Yesterday";
  if (ts >= weekFloor.getTime()) return "This week";
  return "Earlier";
}

export type NotificationGroup = {
  band: DateBand;
  items: UserNotification[];
};

/** Groups items into the {@link DATE_BANDS} preserving insertion order.
 * The list is assumed to be sorted newest-first by the server; we do not
 * re-sort to avoid surprising the caller.
 */
export function groupByDateBand(
  items: ReadonlyArray<UserNotification>,
  now: Date = new Date(),
): NotificationGroup[] {
  const buckets = new Map<DateBand, UserNotification[]>();
  for (const item of items) {
    const band = dateBand(item.createdAt, now);
    const bucket = buckets.get(band);
    if (bucket) bucket.push(item);
    else buckets.set(band, [item]);
  }
  const result: NotificationGroup[] = [];
  for (const band of DATE_BANDS) {
    const list = buckets.get(band);
    if (list && list.length > 0) result.push({ band, items: list });
  }
  return result;
}

/** Returns a `{ key: count }` map of type counts derived from the loaded
 * page. Used to render chip badges. Pure.
 */
export function countByType(items: ReadonlyArray<UserNotification>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const n of items) {
    out[n.type] = (out[n.type] ?? 0) + 1;
  }
  return out;
}
