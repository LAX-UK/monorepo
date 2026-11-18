import type {
  AdminZohoMirrorStatus,
  ZohoMirrorEntity,
  ZohoMirrorNotApplicableReason,
} from "@auction/shop-contracts";
import {
  ARTWORK_LISTING_SKIP,
  ARTWORK_WRITEBACK_SKIP,
  ORDER_EVENTS_THAT_SET_PRINTS,
  ORDER_MIRROR_SKIP,
  ZOHO_ARTWORK_LISTING_CONSUMER,
  type ZohoMirrorMode,
} from "@auction/types";
import type { MirrorDelivery } from "../ports/zoho-mirror.ports.js";

/** What the ledger says about one record, before it is given an id and a consumer. */
export type DerivedZohoMirror = Omit<AdminZohoMirrorStatus, "entity" | "id" | "consumer">;

/** What is known about a record besides its deliveries. */
export type ZohoMirrorContext = {
  /** The mode shop-api is configured with for this record's mirror; null when it is not told. */
  mode: ZohoMirrorMode | null;
  /**
   * For an artwork: the LAX listing's mode (`ZOHO_ARTWORK_LISTING_MODE`), used for the listing's
   * own deliveries in place of `mode` (the writeback's). Null or absent when it is not told.
   */
  listingMode?: ZohoMirrorMode | null;
  /** For an order: whether it is paid; null when not known (or not an order). */
  paid: boolean | null;
};

const UNKNOWN: ZohoMirrorContext = { mode: null, paid: null };

/**
 * How one consumer's ledger reads: what its skip reasons (the text the worker leaves in
 * `last_error` of a skipped delivery) mean, and which of its deliveries are about the same part of
 * the record. The reasons are the worker's own constants from `@auction/types`; a reason named
 * nowhere here is "nothing to mirror".
 */
type LedgerReading = {
  /** Nothing to send: Zoho already holds what LAX would write. Counts as mirrored. */
  inSync: readonly string[];
  /** LAX worked out its writes and wrote none. */
  dryRun: readonly string[];
  /** The record could not be mirrored and staff have been told; counts as failed. */
  failed: readonly string[];
  /** The mirror is switched off. */
  off: readonly string[];
  notPaid: readonly string[];
  notInRegister: readonly string[];
  /** The part of the record a delivery wrote (or failed to). */
  partOf(delivery: MirrorDelivery): string;
  /** Whether a good delivery of one part shows a failure of another is now put right. */
  settles(goodPart: string, failedPart: string): boolean;
  /** Whether a delivery's provider reference names the Zoho record (not, say, a count). */
  namesRecord(delivery: MirrorDelivery): boolean;
};

/**
 * An order's events each run the whole order, but only payment and a swap report prints that
 * cannot be mirrored; a pick or dispatch after them succeeds without the prints (the failure was
 * already raised). So a print failure is put right only by a later good delivery of an event that
 * sets the prints; any other failure by any later good delivery.
 */
const PRINTS = "prints";
const WHOLE_ORDER = "order";
/** An artwork's LAX listing fields, written by the listing consumer. */
const LISTING = "listing";

const READING: Record<ZohoMirrorEntity, LedgerReading> = {
  order: {
    inSync: [ORDER_MIRROR_SKIP.alreadyInSync],
    dryRun: [ORDER_MIRROR_SKIP.dryRun],
    failed: [ORDER_MIRROR_SKIP.printsNotMirrored],
    off: [],
    notPaid: [ORDER_MIRROR_SKIP.orderNotPaid],
    notInRegister: [],
    partOf: (delivery) =>
      ORDER_EVENTS_THAT_SET_PRINTS.has(delivery.eventType) ||
      delivery.lastError === ORDER_MIRROR_SKIP.printsNotMirrored
        ? PRINTS
        : WHOLE_ORDER,
    settles: (goodPart, failedPart) => goodPart === PRINTS || failedPart === WHOLE_ORDER,
    namesRecord: () => true,
  },
  // Each write-back event writes its own field (the Status, the stock code), and the LAX listing
  // writes its own fields on the same Product: one is put right only by a later good delivery of
  // the same part. Both consumers' deliveries are read; the listing's skip reasons are its own.
  artwork: {
    inSync: [
      ARTWORK_WRITEBACK_SKIP.statusAlreadyInSync,
      ARTWORK_WRITEBACK_SKIP.stockCodeAlreadyInSync,
      ARTWORK_LISTING_SKIP.listingAlreadyInSync,
      ARTWORK_LISTING_SKIP.newerListingInZoho,
    ],
    dryRun: [ARTWORK_WRITEBACK_SKIP.dryRun, ARTWORK_LISTING_SKIP.dryRun],
    failed: [ARTWORK_WRITEBACK_SKIP.statusConflictRaised],
    off: [ARTWORK_WRITEBACK_SKIP.writebackOff],
    notPaid: [],
    notInRegister: [ARTWORK_WRITEBACK_SKIP.registerEntryMissing],
    partOf: (delivery) =>
      delivery.consumer === ZOHO_ARTWORK_LISTING_CONSUMER ? LISTING : delivery.eventType,
    settles: (goodPart, failedPart) => goodPart === failedPart,
    // The listing's reference is how many Products it wrote, not a record.
    namesRecord: (delivery) => delivery.consumer !== ZOHO_ARTWORK_LISTING_CONSUMER,
  },
};

/** Every skip reason the reader gives a meaning to, per record; for the contract test. */
export function namedSkipReasons(entity: ZohoMirrorEntity): readonly string[] {
  const { inSync, dryRun, failed, off, notPaid, notInRegister } = READING[entity];
  return [...inSync, ...dryRun, ...failed, ...off, ...notPaid, ...notInRegister];
}

const UNFINISHED = new Set<MirrorDelivery["status"]>(["pending", "processing", "retryable"]);

type Outcome =
  | "good"
  | "failing"
  | "unfinished"
  | "dry_run"
  | "off"
  | "not_paid"
  | "not_in_register"
  | "other";

function outcomeOf(delivery: MirrorDelivery, reading: LedgerReading): Outcome {
  if (delivery.status === "succeeded") return "good";
  if (delivery.status === "dead_lettered") return "failing";
  if (UNFINISHED.has(delivery.status)) return "unfinished";
  const reason = delivery.lastError ?? "";
  if (reading.inSync.includes(reason)) return "good";
  if (reading.failed.includes(reason)) return "failing";
  if (reading.dryRun.includes(reason)) return "dry_run";
  if (reading.off.includes(reason)) return "off";
  if (reading.notPaid.includes(reason)) return "not_paid";
  if (reading.notInRegister.includes(reason)) return "not_in_register";
  return "other";
}

/**
 * The mode a delivery proves. The worker records a success or an "already in sync" skip only when
 * it runs live (a dry run returns before either), a dry-run skip only in a dry run, and an off skip
 * only when off. Anything else proves nothing.
 */
function modeProvedBy(outcome: Outcome): ZohoMirrorMode | null {
  if (outcome === "good") return "live";
  if (outcome === "dry_run") return "dry_run";
  if (outcome === "off") return "off";
  return null;
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
  reason: ZohoMirrorNotApplicableReason,
  mode: ZohoMirrorMode | null,
  delivery?: MirrorDelivery,
): DerivedZohoMirror {
  return {
    ...BLANK,
    notApplicableReason: reason,
    mode,
    lastAttemptAt: iso(delivery?.updatedAt ?? null),
    attempts: delivery?.attempts ?? 0,
  };
}

/** The mode configured for the consumer that made a delivery: the listing's for its own deliveries. */
function configuredModeOf(
  delivery: MirrorDelivery,
  context: ZohoMirrorContext,
): ZohoMirrorMode | null {
  return delivery.consumer === ZOHO_ARTWORK_LISTING_CONSUMER
    ? (context.listingMode ?? null)
    : context.mode;
}

/** The newest failure that no later good delivery of the same part has put right, if any. */
function standingFailure(
  deliveries: readonly MirrorDelivery[],
  outcomes: readonly Outcome[],
  reading: LedgerReading,
): MirrorDelivery | null {
  for (let i = deliveries.length - 1; i >= 0; i--) {
    if (outcomes[i] !== "failing") continue;
    const failedPart = reading.partOf(deliveries[i] as MirrorDelivery);
    const settled = deliveries.some(
      (later, j) =>
        j > i && outcomes[j] === "good" && reading.settles(reading.partOf(later), failedPart),
    );
    if (!settled) return deliveries[i] as MirrorDelivery;
  }
  return null;
}

/**
 * The one state a record has, from its deliveries (oldest event first), nothing stored.
 *
 * A failure stands until a later good delivery of the same part of the record puts it right, so an
 * unrelated later success never hides it, and it wins over anything newer. Otherwise the newest
 * delivery decides. A good delivery is a success, or a skip because Zoho already held the data.
 * A mirror switched off, or an unpaid order with nothing sent, reads as not applicable.
 */
export function deriveZohoMirrorState(
  entity: ZohoMirrorEntity,
  deliveries: readonly MirrorDelivery[],
  context: ZohoMirrorContext = UNKNOWN,
): DerivedZohoMirror {
  const reading = READING[entity];
  const outcomes = deliveries.map((delivery) => outcomeOf(delivery, reading));

  const failed = standingFailure(deliveries, outcomes, reading);
  if (failed) {
    return {
      ...BLANK,
      state: "failed",
      notApplicableReason: null,
      mode: configuredModeOf(failed, context),
      lastAttemptAt: iso(failed.updatedAt),
      attempts: failed.attempts,
      error: failed.status === "dead_lettered" ? failed.lastError : null,
    };
  }

  const latest = deliveries.length - 1;
  const newest = deliveries[latest];
  const newestOutcome = outcomes[latest];
  if (!newest || newestOutcome === undefined) {
    if (context.mode === "off") return notApplicable("mirroring_off", "off");
    if (entity === "order" && context.paid === false)
      return notApplicable("not_paid", context.mode);
    return notApplicable("not_sent_yet", context.mode);
  }

  // Off, nothing more will be sent: only a record already in Zoho still reads as mirrored. The mode
  // is the one of the consumer that made the newest delivery (an artwork's listing has its own).
  const configured = configuredModeOf(newest, context);
  if (configured === "off" && newestOutcome !== "good") {
    return notApplicable("mirroring_off", "off", newest);
  }

  const mode = modeProvedBy(newestOutcome) ?? configured;
  switch (newestOutcome) {
    case "good": {
      const reference = [...deliveries]
        .reverse()
        .find(
          (delivery) =>
            delivery.status === "succeeded" &&
            delivery.providerReference &&
            reading.namesRecord(delivery),
        );
      return {
        ...BLANK,
        state: "mirrored",
        notApplicableReason: null,
        mode,
        lastAttemptAt: iso(newest.updatedAt),
        attempts: newest.attempts,
        providerReference: reference?.providerReference ?? null,
      };
    }
    case "unfinished":
      return {
        ...BLANK,
        state: "pending",
        notApplicableReason: null,
        mode,
        lastAttemptAt: iso(newest.updatedAt),
        nextRetryAt: iso(newest.nextRetryAt),
        attempts: newest.attempts,
      };
    case "dry_run":
      return {
        ...notApplicable("nothing_to_mirror", mode, newest),
        state: "dry_run",
        notApplicableReason: null,
      };
    case "off":
      return notApplicable("mirroring_off", mode, newest);
    case "not_paid":
      return notApplicable("not_paid", mode, newest);
    case "not_in_register":
      return notApplicable("not_in_register", mode, newest);
    default:
      return notApplicable("nothing_to_mirror", mode, newest);
  }
}
