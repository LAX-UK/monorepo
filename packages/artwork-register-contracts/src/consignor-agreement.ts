import { LONDON_TIME_ZONE, dayKey } from "@auction/datetime";

/**
 * Consignor agreements for stock moves (register item ZI-5, option B of
 * docs/design/decision-pack-2026-11-17.md). A consignor is a client in LAX Admin; each agreement
 * says where LAX may offer that client's works (LAX Bid, lax.art, private sale), from and until
 * when, and optionally at what lowest price and commission. An agreement is replaced by a new
 * version, never edited in place, and retired rather than deleted. Each original in the register
 * names its consignor (a client, or "LAX owns this work"), changed only with a reason.
 *
 * These are the rules every caller shares: the limits (the database repeats them), whether an
 * agreement covers a place on a day, the lowest-price check and what a move does when nothing
 * covers it. The move dialogs ("Offer at auction" and "Offer on lax.art") read them through
 * `readMoveAgreement`.
 */

/** Where an original can be offered. Stored as one flag each. */
export const CONSIGNMENT_PLACES = ["lax_bid", "lax_art", "private_sale"] as const;
export type ConsignmentPlace = (typeof CONSIGNMENT_PLACES)[number];

export const CONSIGNMENT_PLACE_LABELS: Record<ConsignmentPlace, string> = {
  lax_bid: "LAX Bid",
  lax_art: "lax.art",
  private_sale: "Private sale",
};

export const AGREEMENT_NOTE_MAX = 1000;
export const CONSIGNOR_CHANGE_REASON_MAX = 500;
/** A signed file is referenced by its object-storage key; the file itself is stored elsewhere. */
export const AGREEMENT_FILE_KEY_MAX = 512;
/** Letters, digits and `/._-`, starting with a letter or digit, with no empty, `.` or `..` part. */
const FILE_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9/._-]*$/;
const FILE_KEY_BAD_PART = /(^|\/)\.{0,2}(\/|$)/;
/** Lowest price in pence. The column is a 4-byte integer, so this keeps well inside it. */
export const LOWEST_PRICE_PENCE_MAX = 999_999_999;
/** Commission in basis points: 1 is 0.01 %, 10000 is 100 %. */
export const COMMISSION_BASIS_POINTS_MAX = 10_000;

/**
 * Owner decision Q2: while a work has no consignor set, the move keeps the old "The consignor
 * agreed" checkbox as a fallback until the end of this London day; after it, the move blocks.
 */
export const CONSIGNOR_CHECKBOX_FALLBACK_LAST_DAY = "2027-01-31";

/**
 * Owner decision Q1: lax.art is a place on the agreement, but in the first release a move to
 * lax.art only shows the line; it does not block. Only these places block when not covered.
 */
export const BLOCKING_PLACES: readonly ConsignmentPlace[] = ["lax_bid"];

export type AgreementStatus = "current" | "replaced" | "retired";

export type ConsignorAgreement = {
  /** This version's row. */
  id: string;
  /** The agreement across its versions: the id of its first version. */
  agreementId: string;
  version: number;
  /** The consignor: a client (`shop_party`). */
  partyId: string;
  places: ConsignmentPlace[];
  /** London calendar days, `YYYY-MM-DD`, both inclusive. No end means until retired. */
  startsOn: string;
  endsOn: string | null;
  lowestPricePence: number | null;
  commissionBasisPoints: number | null;
  signedFileKey: string;
  note: string | null;
  status: AgreementStatus;
  /** The version this one replaced; null for the first version. */
  replacesId: string | null;
  /** `staff:<user id>`. */
  createdBy: string;
  createdAt: Date;
  replacedAt: Date | null;
  retiredAt: Date | null;
  /** `staff:<user id>`. */
  retiredBy: string | null;
};

/** Who consigned an original: a client, or LAX itself. */
export type Consignor = { kind: "client"; partyId: string } | { kind: "lax" };

export type ConsignorLink = {
  id: string;
  registerId: string;
  consignor: Consignor;
  /** Why it changed; null for the first time it was set. */
  changeReason: string | null;
  /** `staff:<user id>`. */
  setBy: string;
  setAt: Date;
};

// ---------------------------------------------------------------------------------------------
// Input rules
// ---------------------------------------------------------------------------------------------

export type AgreementField =
  | "places"
  | "startsOn"
  | "endsOn"
  | "lowestPricePence"
  | "commissionBasisPoints"
  | "signedFileKey"
  | "note";

export type AgreementIssue = { field: AgreementField; reason: string };

export type AgreementTermsInput = {
  places: readonly string[];
  startsOn: string;
  endsOn?: string | null;
  lowestPricePence?: number | null;
  commissionBasisPoints?: number | null;
  signedFileKey: string;
  note?: string | null;
};

export type AgreementTerms = {
  places: ConsignmentPlace[];
  startsOn: string;
  endsOn: string | null;
  lowestPricePence: number | null;
  commissionBasisPoints: number | null;
  signedFileKey: string;
  note: string | null;
};

/** Characters as Postgres counts them (code points), not UTF-16 units. */
function length(text: string): number {
  return [...text].length;
}

/** True for a real calendar day written `YYYY-MM-DD`. */
export function isCalendarDay(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function isConsignmentPlace(value: string): value is ConsignmentPlace {
  return (CONSIGNMENT_PLACES as readonly string[]).includes(value);
}

/** Places in their fixed order, each once. */
export function orderPlaces(places: readonly ConsignmentPlace[]): ConsignmentPlace[] {
  return CONSIGNMENT_PLACES.filter((place) => places.includes(place));
}

/**
 * The terms of a new agreement or of the version that replaces one. Every issue is listed, so a
 * form can mark each field at once. Amounts are whole minor units: pence and basis points.
 */
export function parseAgreementTerms(
  input: AgreementTermsInput,
): { ok: true; value: AgreementTerms } | { ok: false; issues: AgreementIssue[] } {
  const issues: AgreementIssue[] = [];

  const unknown = input.places.filter((place) => !isConsignmentPlace(place));
  const places = orderPlaces(input.places.filter(isConsignmentPlace));
  if (unknown.length > 0) issues.push({ field: "places", reason: "unknown_place" });
  else if (places.length === 0) issues.push({ field: "places", reason: "required" });

  const startsOn = input.startsOn.trim();
  if (!isCalendarDay(startsOn)) issues.push({ field: "startsOn", reason: "invalid_date" });

  const endsOn = input.endsOn?.trim() || null;
  if (endsOn !== null) {
    if (!isCalendarDay(endsOn)) issues.push({ field: "endsOn", reason: "invalid_date" });
    else if (isCalendarDay(startsOn) && endsOn < startsOn)
      issues.push({ field: "endsOn", reason: "before_start" });
  }

  const lowestPricePence = input.lowestPricePence ?? null;
  if (
    lowestPricePence !== null &&
    (!Number.isInteger(lowestPricePence) ||
      lowestPricePence <= 0 ||
      lowestPricePence > LOWEST_PRICE_PENCE_MAX)
  ) {
    issues.push({ field: "lowestPricePence", reason: "out_of_range" });
  }

  const commissionBasisPoints = input.commissionBasisPoints ?? null;
  if (
    commissionBasisPoints !== null &&
    (!Number.isInteger(commissionBasisPoints) ||
      commissionBasisPoints < 0 ||
      commissionBasisPoints > COMMISSION_BASIS_POINTS_MAX)
  ) {
    issues.push({ field: "commissionBasisPoints", reason: "out_of_range" });
  }

  const signedFileKey = input.signedFileKey.trim();
  if (signedFileKey === "") issues.push({ field: "signedFileKey", reason: "required" });
  else if (
    length(signedFileKey) > AGREEMENT_FILE_KEY_MAX ||
    !FILE_KEY_PATTERN.test(signedFileKey) ||
    FILE_KEY_BAD_PART.test(signedFileKey)
  )
    issues.push({ field: "signedFileKey", reason: "invalid" });

  const note = input.note?.trim() || null;
  if (note !== null && length(note) > AGREEMENT_NOTE_MAX)
    issues.push({ field: "note", reason: "too_long" });

  if (issues.length > 0) return { ok: false, issues };
  return {
    ok: true,
    value: {
      places,
      startsOn,
      endsOn,
      lowestPricePence,
      commissionBasisPoints,
      signedFileKey,
      note,
    },
  };
}

// ---------------------------------------------------------------------------------------------
// Cover
// ---------------------------------------------------------------------------------------------

/** Today as a London calendar day, the day agreements are read against. */
export function agreementDay(now: Date): string {
  return dayKey(now, LONDON_TIME_ZONE);
}

/**
 * Whether the agreement lets LAX offer the consignor's works at `place` on `day` (a London
 * calendar day, `YYYY-MM-DD`). Only the current version of an agreement covers anything: a
 * replaced version has been superseded and a retired one has ended early. Both dates count.
 */
export function agreementCovers(
  agreement: Pick<ConsignorAgreement, "status" | "places" | "startsOn" | "endsOn">,
  place: ConsignmentPlace,
  day: string,
): boolean {
  if (agreement.status !== "current") return false;
  if (!agreement.places.includes(place)) return false;
  if (day < agreement.startsOn) return false;
  if (agreement.endsOn !== null && day > agreement.endsOn) return false;
  return true;
}

/**
 * The agreement that covers `place` on `day`, when several do: the one that runs longest (no end
 * first), then the most recently started, then the newest. Null when none covers it.
 */
export function coveringAgreement<
  A extends Pick<
    ConsignorAgreement,
    "id" | "status" | "places" | "startsOn" | "endsOn" | "createdAt"
  >,
>(agreements: readonly A[], place: ConsignmentPlace, day: string): A | null {
  const covering = agreements.filter((agreement) => agreementCovers(agreement, place, day));
  covering.sort((a, b) => {
    if (a.endsOn !== b.endsOn) {
      if (a.endsOn === null) return -1;
      if (b.endsOn === null) return 1;
      return a.endsOn < b.endsOn ? 1 : -1;
    }
    if (a.startsOn !== b.startsOn) return a.startsOn < b.startsOn ? 1 : -1;
    const created = b.createdAt.getTime() - a.createdAt.getTime();
    if (created !== 0) return created;
    return a.id < b.id ? 1 : -1;
  });
  return covering[0] ?? null;
}

export type ConsignorCover<A = ConsignorAgreement> =
  /** No one has said who consigned the work. */
  | { kind: "no_consignor" }
  /** LAX owns the work: no agreement is needed. */
  | { kind: "lax_owns" }
  | { kind: "covered"; partyId: string; agreement: A }
  | { kind: "not_covered"; partyId: string };

/**
 * What the consignor data says about offering a work at `place` on `day`. `agreements` are the
 * consignor's; any of another client's are ignored.
 */
export function assessConsignorCover<
  A extends Pick<
    ConsignorAgreement,
    "id" | "partyId" | "status" | "places" | "startsOn" | "endsOn" | "createdAt"
  >,
>(input: {
  consignor: Consignor | null;
  agreements: readonly A[];
  place: ConsignmentPlace;
  day: string;
}): ConsignorCover<A> {
  const { consignor } = input;
  if (consignor === null) return { kind: "no_consignor" };
  if (consignor.kind === "lax") return { kind: "lax_owns" };
  const own = input.agreements.filter((agreement) => agreement.partyId === consignor.partyId);
  const agreement = coveringAgreement(own, input.place, input.day);
  return agreement
    ? { kind: "covered", partyId: consignor.partyId, agreement }
    : { kind: "not_covered", partyId: consignor.partyId };
}

export type MoveAgreementCheck =
  /** Covered, LAX owns the work, or a place that does not block yet: the move goes ahead. */
  | { outcome: "allowed" }
  /** No consignor set during the transition: the move asks for the old checkbox instead. */
  | { outcome: "checkbox_fallback" }
  /** The move is refused until an agreement or a consignor is recorded. */
  | { outcome: "blocked"; reason: "no_consignor" | "not_covered" };

/**
 * What a move does with the cover it read (owner decisions Q1 and Q2). lax.art never blocks in
 * the first release. A work with no consignor set falls back to the checkbox up to and including
 * `CONSIGNOR_CHECKBOX_FALLBACK_LAST_DAY`, and blocks after it.
 */
export function checkMoveAgreement(input: {
  cover: ConsignorCover<unknown>;
  place: ConsignmentPlace;
  day: string;
}): MoveAgreementCheck {
  const { cover } = input;
  if (cover.kind === "covered" || cover.kind === "lax_owns") return { outcome: "allowed" };
  if (!BLOCKING_PLACES.includes(input.place)) return { outcome: "allowed" };
  if (cover.kind === "no_consignor") {
    return input.day <= CONSIGNOR_CHECKBOX_FALLBACK_LAST_DAY
      ? { outcome: "checkbox_fallback" }
      : { outcome: "blocked", reason: "no_consignor" };
  }
  return { outcome: "blocked", reason: "not_covered" };
}

export type LowestPriceCheck =
  | { status: "no_lowest_price" }
  | { status: "at_or_above"; lowestPricePence: number }
  /** A warning, not a refusal: staff may still go ahead. */
  | { status: "below"; lowestPricePence: number };

/** Whether a price (in pence) is below the lowest price the agreement sets. */
export function checkLowestPrice(
  agreement: Pick<ConsignorAgreement, "lowestPricePence">,
  pricePence: number,
): LowestPriceCheck {
  const lowest = agreement.lowestPricePence;
  if (lowest === null) return { status: "no_lowest_price" };
  return pricePence < lowest
    ? { status: "below", lowestPricePence: lowest }
    : { status: "at_or_above", lowestPricePence: lowest };
}

// ---------------------------------------------------------------------------------------------
// Versions and retiring
// ---------------------------------------------------------------------------------------------

export type AgreementChangeRefusal = "not_found" | "not_current" | "stale";

/**
 * Whether the version staff were looking at can be replaced or retired. Only the current version
 * changes; `expectedVersion` stops two people replacing the same agreement at once.
 */
export function planAgreementChange(input: {
  current: Pick<ConsignorAgreement, "status" | "version"> | null;
  expectedVersion: number;
}): { ok: true; nextVersion: number } | { ok: false; reason: AgreementChangeRefusal } {
  if (!input.current) return { ok: false, reason: "not_found" };
  if (input.current.status !== "current") return { ok: false, reason: "not_current" };
  if (input.current.version !== input.expectedVersion) return { ok: false, reason: "stale" };
  return { ok: true, nextVersion: input.current.version + 1 };
}

// ---------------------------------------------------------------------------------------------
// The consignor of an original
// ---------------------------------------------------------------------------------------------

export function sameConsignor(a: Consignor | null, b: Consignor | null): boolean {
  if (a === null || b === null) return a === b;
  if (a.kind !== b.kind) return false;
  return a.kind === "lax" || (b.kind === "client" && a.partyId === b.partyId);
}

export type ConsignorChangeRefusal = "reason_required" | "reason_too_long";

/**
 * Setting or changing who consigned an original. The first time needs no reason; any change after
 * it does. Setting the consignor it already has records nothing.
 */
export function planConsignorChange(input: {
  current: Consignor | null;
  next: Consignor;
  reason: string | null | undefined;
}):
  | { ok: true; changes: false }
  | { ok: true; changes: true; reason: string | null }
  | { ok: false; reason: ConsignorChangeRefusal } {
  if (sameConsignor(input.current, input.next)) return { ok: true, changes: false };
  const reason = input.reason?.trim() || null;
  if (reason !== null && length(reason) > CONSIGNOR_CHANGE_REASON_MAX)
    return { ok: false, reason: "reason_too_long" };
  if (input.current !== null && reason === null) return { ok: false, reason: "reason_required" };
  return { ok: true, changes: true, reason };
}

/**
 * The time a consignor change is recorded at: `now`, or just after the previous one when the
 * clock repeats or steps back, so the latest row is always the current consignor.
 */
export function nextConsignorSetTime(now: Date, previous: Date | null): Date {
  return previous && previous.getTime() >= now.getTime() ? new Date(previous.getTime() + 1) : now;
}

// ---------------------------------------------------------------------------------------------
// What a move reads
// ---------------------------------------------------------------------------------------------

/**
 * Where the consignor's agreement stands for one move, as the move dialogs show it: in force, not
 * started yet, past its end date, retired, none at all for that place, no consignor set, or LAX
 * owns the work.
 */
export const MOVE_AGREEMENT_STATES = [
  "in_force",
  "not_started",
  "expired",
  "retired",
  "none",
  "no_consignor",
  "lax_owns",
] as const;
export type MoveAgreementState = (typeof MOVE_AGREEMENT_STATES)[number];

export type MoveAgreementReading<A> = {
  state: MoveAgreementState;
  /** The client who consigned the work; null when none is set or LAX owns it. */
  partyId: string | null;
  /**
   * The agreement the state is about: the one in force, the next to start, or the one that ended
   * last. Null for `none`, `no_consignor` and `lax_owns`.
   */
  agreement: A | null;
  /** What the move does with it (owner decisions Q1 and Q2). */
  check: MoveAgreementCheck;
};

type ReadableAgreement = Pick<
  ConsignorAgreement,
  "id" | "partyId" | "status" | "places" | "startsOn" | "endsOn" | "createdAt" | "retiredAt"
>;

/** The day an agreement stopped covering anything: its end date, or the London day it was retired. */
function endedOn(agreement: ReadableAgreement): string | null {
  if (agreement.status === "retired")
    return agreement.retiredAt ? agreementDay(agreement.retiredAt) : null;
  return agreement.endsOn;
}

/**
 * Reads the consignor and their agreements for a move to `place` on `day`. When nothing covers
 * the place, the agreement that explains why is picked: one that starts later comes first (it is
 * the one staff are waiting on), then the one that stopped most recently, expired or retired.
 * Replaced versions are ignored; another client's agreements are too.
 */
export function readMoveAgreement<A extends ReadableAgreement>(input: {
  consignor: Consignor | null;
  agreements: readonly A[];
  place: ConsignmentPlace;
  day: string;
}): MoveAgreementReading<A> {
  const cover = assessConsignorCover(input);
  const check = checkMoveAgreement({ cover, place: input.place, day: input.day });
  if (cover.kind === "no_consignor")
    return { state: "no_consignor", partyId: null, agreement: null, check };
  if (cover.kind === "lax_owns")
    return { state: "lax_owns", partyId: null, agreement: null, check };
  if (cover.kind === "covered")
    return { state: "in_force", partyId: cover.partyId, agreement: cover.agreement, check };

  const forPlace = input.agreements.filter(
    (agreement) =>
      agreement.partyId === cover.partyId &&
      agreement.status !== "replaced" &&
      agreement.places.includes(input.place),
  );
  const upcoming = forPlace
    .filter((agreement) => agreement.status === "current" && agreement.startsOn > input.day)
    .sort((a, b) => (a.startsOn < b.startsOn ? -1 : a.startsOn > b.startsOn ? 1 : 0))[0];
  if (upcoming) return { state: "not_started", partyId: cover.partyId, agreement: upcoming, check };

  const ended = forPlace
    .map((agreement) => ({ agreement, on: endedOn(agreement) ?? "" }))
    .sort((a, b) => (a.on < b.on ? 1 : a.on > b.on ? -1 : 0))[0];
  if (ended) {
    const state = ended.agreement.status === "retired" ? "retired" : "expired";
    return { state, partyId: cover.partyId, agreement: ended.agreement, check };
  }
  return { state: "none", partyId: cover.partyId, agreement: null, check };
}

/**
 * What the register history keeps about the agreement a move read: the place, the state and, when
 * there was one, the agreement version. `belowLowestPrice` marks a move to auction that went ahead
 * below the lowest price agreed (a warning, not a refusal).
 */
export type MoveAgreementRecord = {
  place: ConsignmentPlace;
  state: MoveAgreementState;
  consignorPartyId?: string;
  /** The agreement across its versions. */
  agreementId?: string;
  /** The version's own row. */
  agreementVersionId?: string;
  version?: number;
  belowLowestPrice?: true;
};

/** The history record for a reading. */
export function moveAgreementRecord(
  reading: MoveAgreementReading<Pick<ConsignorAgreement, "id" | "agreementId" | "version">>,
  place: ConsignmentPlace,
  options: { belowLowestPrice?: boolean } = {},
): MoveAgreementRecord {
  const { agreement } = reading;
  return {
    place,
    state: reading.state,
    ...(reading.partyId ? { consignorPartyId: reading.partyId } : {}),
    ...(agreement
      ? {
          agreementId: agreement.agreementId,
          agreementVersionId: agreement.id,
          version: agreement.version,
        }
      : {}),
    ...(options.belowLowestPrice ? { belowLowestPrice: true as const } : {}),
  };
}
