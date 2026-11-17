import type {
  AdminZohoMirrorStatus,
  ZohoMirrorEntity,
  ZohoMirrorNotApplicableReason,
} from "@auction/shop-contracts";
import type { MirrorDelivery } from "../ports/zoho-mirror.ports.js";

/** What the ledger says about one record, before it is given an id and a consumer. */
export type DerivedZohoMirror = Omit<AdminZohoMirrorStatus, "entity" | "id" | "consumer">;

/**
 * How a consumer's skip reasons (the text the worker leaves in `last_error` of a skipped
 * delivery) read. A reason named nowhere is "nothing to mirror".
 */
type SkipReasons = {
  /** Nothing to send: Zoho already holds what LAX would write. Counts as mirrored. */
  inSync: readonly string[];
  /** LAX worked out its writes and wrote none. */
  dryRun: readonly string[];
  /** The record could not be mirrored and staff have been told; counts as failed. */
  failed: readonly string[];
  /** The mirror is switched off. */
  off: readonly string[];
  notPaid: readonly string[];
};

const SKIP_REASONS: Record<ZohoMirrorEntity, SkipReasons> = {
  order: {
    inSync: ["order_already_in_sync"],
    dryRun: ["dry_run"],
    failed: ["order_prints_not_mirrored"],
    off: [],
    notPaid: ["order_not_paid"],
  },
  artwork: {
    inSync: ["status_already_in_sync", "stock_code_already_in_sync"],
    dryRun: ["dry_run"],
    failed: [],
    off: ["writeback_off"],
    notPaid: [],
  },
};

const UNFINISHED = new Set<MirrorDelivery["status"]>(["pending", "processing", "retryable"]);

type Outcome = "good" | "failing" | "unfinished" | "dry_run" | "off" | "other";

function outcomeOf(delivery: MirrorDelivery, reasons: SkipReasons): Outcome {
  if (delivery.status === "succeeded") return "good";
  if (delivery.status === "dead_lettered") return "failing";
  if (UNFINISHED.has(delivery.status)) return "unfinished";
  const reason = delivery.lastError ?? "";
  if (reasons.inSync.includes(reason)) return "good";
  if (reasons.failed.includes(reason)) return "failing";
  if (reasons.dryRun.includes(reason)) return "dry_run";
  if (reasons.off.includes(reason)) return "off";
  return "other";
}

const BLANK: DerivedZohoMirror = {
  state: "not_applicable",
  notApplicableReason: "not_sent_yet",
  mode: null,
  lastAttemptAt: null,
  nextRetryAt: null,
  attempts: 0,
  providerReference: null,
  error: null,
};

const iso = (date: Date | null) => date?.toISOString() ?? null;

function notApplicable(
  delivery: MirrorDelivery,
  reason: ZohoMirrorNotApplicableReason,
  mode: DerivedZohoMirror["mode"],
): DerivedZohoMirror {
  return {
    ...BLANK,
    notApplicableReason: reason,
    mode,
    lastAttemptAt: iso(delivery.updatedAt),
    attempts: delivery.attempts,
  };
}

/**
 * The one state a record has, from its deliveries (oldest event first), nothing stored.
 *
 * A failure not since followed by a good delivery wins over anything newer that is still
 * unfinished: staff must see it. Otherwise the newest delivery decides. A good delivery is a
 * success, or a skip because Zoho already held the data.
 */
export function deriveZohoMirrorState(
  entity: ZohoMirrorEntity,
  deliveries: readonly MirrorDelivery[],
): DerivedZohoMirror {
  const reasons = SKIP_REASONS[entity];
  const outcomes = deliveries.map((delivery) => outcomeOf(delivery, reasons));
  const latest = deliveries.length - 1;
  if (latest < 0) return BLANK;

  const lastGood = outcomes.lastIndexOf("good");
  const lastFailing = outcomes.lastIndexOf("failing");
  if (lastFailing > lastGood) {
    const failed = deliveries[lastFailing] as MirrorDelivery;
    return {
      ...BLANK,
      state: "failed",
      notApplicableReason: null,
      mode: "live",
      lastAttemptAt: iso(failed.updatedAt),
      attempts: failed.attempts,
      error: failed.status === "dead_lettered" ? failed.lastError : null,
    };
  }

  const newest = deliveries[latest] as MirrorDelivery;
  switch (outcomes[latest]) {
    case "good": {
      const sent = deliveries[lastGood] as MirrorDelivery;
      const reference = [...deliveries]
        .reverse()
        .find((delivery) => delivery.status === "succeeded" && delivery.providerReference);
      return {
        ...BLANK,
        state: "mirrored",
        notApplicableReason: null,
        mode: "live",
        lastAttemptAt: iso(sent.updatedAt),
        attempts: sent.attempts,
        providerReference: reference?.providerReference ?? null,
      };
    }
    case "unfinished":
      return {
        ...BLANK,
        state: "pending",
        notApplicableReason: null,
        lastAttemptAt: iso(newest.updatedAt),
        nextRetryAt: iso(newest.nextRetryAt),
        attempts: newest.attempts,
      };
    case "dry_run":
      return {
        ...notApplicable(newest, "nothing_to_mirror", "dry_run"),
        state: "dry_run",
        notApplicableReason: null,
      };
    case "off":
      return notApplicable(newest, "mirroring_off", "off");
    default:
      return notApplicable(
        newest,
        reasons.notPaid.includes(newest.lastError ?? "") ? "not_paid" : "nothing_to_mirror",
        null,
      );
  }
}
