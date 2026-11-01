import type { LotLifecycleKind } from "@/lib/lot/lot-lifecycle";

export type LiveFeedHeaderMeta = {
  title: string;
  statusLabel: string;
  pulse: boolean;
  tone: "live" | "upcoming" | "ended";
};

/** Header copy for `LiveBidFeed` from unified lot lifecycle. */
export function getLiveFeedHeaderMeta(
  lifecycleKind: LotLifecycleKind,
  opts?: { countdownClock?: string; watcherCount?: number | null },
): LiveFeedHeaderMeta {
  const { countdownClock, watcherCount } = opts ?? {};

  if (lifecycleKind === "saleroomPaused") {
    return { title: "Live feed", statusLabel: "Auction paused", pulse: false, tone: "live" };
  }

  if (
    lifecycleKind === "live" ||
    lifecycleKind === "extended" ||
    lifecycleKind === "liveSaleroom"
  ) {
    if (watcherCount != null) {
      const label =
        watcherCount >= 1000
          ? `${Math.floor(watcherCount / 1000)}k watching`
          : `${watcherCount} watching`;
      return { title: "Live feed", statusLabel: label, pulse: false, tone: "live" };
    }
    return { title: "Live feed", statusLabel: "Live now", pulse: true, tone: "live" };
  }

  if (lifecycleKind === "scheduled" || lifecycleKind === "preLaunch") {
    const opens =
      countdownClock && countdownClock.trim() !== "" ? `Opens in ${countdownClock}` : "Opens soon";
    return { title: "Bid activity", statusLabel: opens, pulse: false, tone: "upcoming" };
  }

  return { title: "Bid history", statusLabel: "Bidding closed", pulse: false, tone: "ended" };
}
