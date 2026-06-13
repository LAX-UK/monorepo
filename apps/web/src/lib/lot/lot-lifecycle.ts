import { classifyLotTimerState } from "@/components/lot-timer";
import type { Lot, Sale } from "@auction/types";
import { toLotCardTimingVM } from "@auction/validators";

export type LotLifecycleKind =
  | "preLaunch"
  | "scheduled"
  | "live"
  | "extended"
  | "endedSold"
  | "endedNoSale"
  | "cancelled"
  | "withdrawn";

export type LotLifecycle = {
  kind: LotLifecycleKind;
  /** ms until next meaningful instant (open for scheduled, close for live/extended); null when terminal or unknown */
  msLeft: number | null;
  winnerId?: string | null;
};

export type LifecycleBadgeTone = "live" | "upcoming" | "warn" | "ended" | "muted";

export type LifecycleBadgeVM = {
  label: string;
  tone: LifecycleBadgeTone;
  pulse: boolean;
};

type LotLifecycleLot = Pick<
  Lot,
  "status" | "startTime" | "endTime" | "winnerId" | "reservePrice" | "currentPrice" | "id"
>;

type LotLifecycleSale = Pick<Sale, "status" | "deliveryMode"> | null;

/**
 * Single source of truth for lot UX state (badges, banners, bid gating copy).
 * Online lots: pass parent sale when known so draft-sale catalogue shows as preLaunch.
 */
export function classifyLotLifecycle(
  lot: LotLifecycleLot,
  sale: LotLifecycleSale,
  nowMs: number,
  opts?: { recentlyExtended?: boolean },
): LotLifecycle {
  if (lot.status === "voided") {
    return { kind: "withdrawn", msLeft: null };
  }
  if (lot.status === "cancelled") {
    return { kind: "cancelled", msLeft: null };
  }
  if (lot.status === "draft") {
    return { kind: "preLaunch", msLeft: null };
  }
  if (sale?.status === "draft" && lot.status === "scheduled") {
    return { kind: "preLaunch", msLeft: null };
  }

  if (lot.status === "ended") {
    if (lot.winnerId) {
      return { kind: "endedSold", msLeft: null, winnerId: lot.winnerId };
    }
    return { kind: "endedNoSale", msLeft: null };
  }

  const timer = classifyLotTimerState(toLotCardTimingVM(lot), nowMs);

  if (timer.kind === "opensSoon") {
    return { kind: "scheduled", msLeft: timer.msLeft };
  }
  if (timer.kind === "live") {
    if (opts?.recentlyExtended) {
      return { kind: "extended", msLeft: timer.msLeft };
    }
    return { kind: "live", msLeft: timer.msLeft };
  }
  if (timer.kind === "closed") {
    if (lot.winnerId) {
      return { kind: "endedSold", msLeft: null, winnerId: lot.winnerId };
    }
    return { kind: "endedNoSale", msLeft: null };
  }
  if (timer.kind === "cancelled") {
    return { kind: "cancelled", msLeft: null };
  }

  if (lot.status === "scheduled") {
    const startMs = new Date(lot.startTime).getTime();
    if (Number.isFinite(startMs) && startMs > nowMs) {
      return { kind: "scheduled", msLeft: startMs - nowMs };
    }
    if (Number.isFinite(startMs) && startMs <= nowMs) {
      return { kind: "scheduled", msLeft: 0 };
    }
  }

  return { kind: "preLaunch", msLeft: null };
}

export function lifecycleBadge(lifecycle: LotLifecycle): LifecycleBadgeVM {
  switch (lifecycle.kind) {
    case "preLaunch":
      return { label: "Preview", tone: "muted", pulse: false };
    case "scheduled":
      return { label: "Opens soon", tone: "upcoming", pulse: false };
    case "live":
      return { label: "Live now", tone: "live", pulse: true };
    case "extended":
      return { label: "Extended", tone: "warn", pulse: true };
    case "endedSold":
      return { label: "Sold", tone: "ended", pulse: false };
    case "endedNoSale":
      return { label: "No sale", tone: "ended", pulse: false };
    case "cancelled":
      return { label: "Cancelled", tone: "muted", pulse: false };
    case "withdrawn":
      return { label: "Withdrawn", tone: "muted", pulse: false };
    default: {
      const _never: never = lifecycle.kind;
      return _never;
    }
  }
}
