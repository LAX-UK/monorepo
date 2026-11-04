import type { ArtworkRegisterEntry } from "./entry.js";
import {
  type LockMessage,
  type LockReason,
  type OfferPlaceDetail,
  lockMessage,
} from "./lock-messages.js";
import type { OfferRef, OfferRefKind, OfferState, OfferTransitionRefusal } from "./offer-state.js";
import { isReservedInZoho, isSoldInZoho } from "./sold-in-gallery.js";

const STATE_FOR_REF_KIND: Record<OfferRefKind, OfferState> = {
  shop_artwork: "lax_art",
  bid_lot: "bid_sale",
  private_sale: "private_sale",
};

/**
 * Why an offer is refused. `sold` is a sale made through LAX; `sold_in_gallery` is a sale only
 * Zoho knows about; `reserved_in_zoho` is a hold set by hand in Zoho.
 */
export type OfferRefusalReason =
  | "offered_elsewhere"
  | "sold"
  | "sold_in_gallery"
  | "reserved_in_zoho";

const LOCK_REASON_FOR_PLACE: Partial<Record<OfferState, LockReason>> = {
  lax_art: "live_on_lax_art",
  bid_sale: "in_bid_sale",
  private_sale: "in_private_sale",
};

function lockReasonFor(reason: OfferRefusalReason, state: OfferState): LockReason {
  if (reason === "sold") return "sold_through_lax";
  if (reason === "sold_in_gallery") return "sold_in_gallery";
  if (reason === "reserved_in_zoho") return "reserved_in_zoho";
  return LOCK_REASON_FOR_PLACE[state] ?? "live_on_lax_art";
}

/** The refusal with its message and the link that goes with it. */
export function offerRefusal(
  reason: OfferRefusalReason,
  state: OfferState,
  detail?: OfferPlaceDetail,
): LockMessage {
  return lockMessage(lockReasonFor(reason, state), detail);
}

export function offerRefusalMessage(
  reason: OfferRefusalReason,
  state: OfferState,
  detail?: OfferPlaceDetail,
): string {
  return offerRefusal(reason, state, detail).message;
}

/** Why an offer in this state is refused: sold through LAX, sold in the gallery, or held elsewhere. */
export function offerRefusalReason(offer: ArtworkRegisterEntry["offer"]): OfferRefusalReason {
  if (offer.state !== "sold") return "offered_elsewhere";
  return offer.ref === null ? "sold_in_gallery" : "sold";
}

/** Staff tried to offer an artwork that is already offered in another place, or already sold. */
export class ArtworkOfferedElsewhereError extends Error {
  readonly code = "artwork_offered_elsewhere";
  readonly lock: LockMessage;
  constructor(
    readonly reason: OfferRefusalReason,
    readonly state: OfferState,
    detail?: OfferPlaceDetail,
  ) {
    const lock = offerRefusal(reason, state, detail);
    super(lock.message);
    this.name = "ArtworkOfferedElsewhereError";
    this.lock = lock;
  }
}

/** A move the register refused or could not make; the caller's change should not go ahead. */
export class ArtworkOfferMoveError extends Error {
  readonly code = "artwork_offer_move_failed";
  constructor(
    readonly reason: string,
    readonly registerId: string,
  ) {
    super(`The artwork register could not record this change (${reason}). Try again.`);
    this.name = "ArtworkOfferMoveError";
  }
}

function sameRef(a: OfferRef | null, b: OfferRef): boolean {
  return a !== null && a.kind === b.kind && a.id === b.id;
}

/** True when this entry is currently offered at exactly this place. */
export function isOfferedAt(entry: ArtworkRegisterEntry, ref: OfferRef): boolean {
  return entry.offer.state === STATE_FOR_REF_KIND[ref.kind] && sameRef(entry.offer.ref, ref);
}

/**
 * Whether an artwork may be offered at this place. Prints are sold in runs, not one place at a
 * time, so only originals are governed. An artwork that is held or withdrawn may be offered; one
 * already offered at this place may be offered again (a retry); anything else is refused. Zoho's
 * own status counts too: Sold means it left the building, and Reserved holds back new offers
 * (an offer already made is left alone).
 */
export function checkOfferable(
  entry: ArtworkRegisterEntry,
  ref: OfferRef,
): { ok: true } | { ok: false; error: ArtworkOfferedElsewhereError } {
  if (entry.kind !== "original") return { ok: true };
  const { state } = entry.offer;
  if (state === "held" || state === "withdrawn") {
    if (isSoldInZoho(entry.catalogueStatus)) {
      return { ok: false, error: new ArtworkOfferedElsewhereError("sold_in_gallery", state) };
    }
    if (isReservedInZoho(entry.catalogueStatus)) {
      return { ok: false, error: new ArtworkOfferedElsewhereError("reserved_in_zoho", state) };
    }
    return { ok: true };
  }
  if (isOfferedAt(entry, ref)) return { ok: true };
  return {
    ok: false,
    error: new ArtworkOfferedElsewhereError(offerRefusalReason(entry.offer), state),
  };
}

/** How a product points at its register entry: by id, or by the Zoho Product id it already holds. */
export type RegisterLink = { registerId: string } | { zohoProductId: string };

export type OfferLockRegister = {
  findById(id: string): Promise<ArtworkRegisterEntry | null>;
  findByZohoProductId(zohoProductId: string): Promise<ArtworkRegisterEntry | null>;
  moveOffer(input: {
    registerId: string;
    expectedVersion: number;
    to: OfferState;
    ref: OfferRef | null;
    actor: string;
    now: Date;
  }): Promise<
    | { ok: true; entry: ArtworkRegisterEntry }
    | { ok: false; reason: "not_found" | "version_conflict" | OfferTransitionRefusal }
  >;
};

export type OfferLockOutcome =
  /** The product has no register entry (or it is not an original): nothing to lock. */
  | { status: "not_governed" }
  /** The register already shows what this change would record. */
  | { status: "unchanged"; entry: ArtworkRegisterEntry }
  | { status: "moved"; entry: ArtworkRegisterEntry }
  /** The register shows the artwork somewhere else, so this change is not recorded. */
  | { status: "skipped"; reason: OfferRefusalReason; entry: ArtworkRegisterEntry };

const MAX_ATTEMPTS = 3;

/** Another change reached the register first; the caller reads again and retries. */
class VersionConflict extends Error {}

/**
 * One place at a time. Products ask it before they offer an artwork and tell it when the offer
 * ends or sells. It reads and writes the register only through the narrow port above, so the
 * rules run without a database. A product with no register entry is not governed: every call is a
 * no-op, which keeps the products working as before until the register is filled.
 */
export class ArtworkOfferLock {
  constructor(
    private readonly register: OfferLockRegister,
    private readonly now: () => Date = () => new Date(),
  ) {}

  /** Throws `ArtworkOfferedElsewhereError` when the artwork cannot be offered at this place. */
  async assertCanOffer(link: RegisterLink | null, ref: OfferRef): Promise<void> {
    const entry = await this.resolve(link);
    if (!entry) return;
    const check = checkOfferable(entry, ref);
    if (!check.ok) throw check.error;
  }

  /** Checks, then records the artwork as offered at this place. Safe to repeat. */
  offer(link: RegisterLink | null, ref: OfferRef, actor: string): Promise<OfferLockOutcome> {
    return this.change(link, async (entry) => {
      if (entry.kind !== "original") return { status: "not_governed" };
      const check = checkOfferable(entry, ref);
      if (!check.ok) throw check.error;
      if (isOfferedAt(entry, ref)) return { status: "unchanged", entry };
      return this.move(entry, STATE_FOR_REF_KIND[ref.kind], ref, actor);
    });
  }

  /** Records that the offer at this place ended. An offer made elsewhere is left alone. */
  withdraw(link: RegisterLink | null, ref: OfferRef, actor: string): Promise<OfferLockOutcome> {
    return this.change(link, async (entry) => {
      if (entry.kind !== "original") return { status: "not_governed" };
      if (!isOfferedAt(entry, ref)) return { status: "unchanged", entry };
      return this.move(entry, "withdrawn", null, actor);
    });
  }

  /**
   * Records the sale made at this place. A sale at a place the register does not show as offered
   * (the offer was never recorded) is recorded through that place first; a sale the register
   * places elsewhere is reported as skipped, never forced.
   */
  markSold(link: RegisterLink | null, ref: OfferRef, actor: string): Promise<OfferLockOutcome> {
    return this.change(link, async (entry) => {
      if (entry.kind !== "original") return { status: "not_governed" };
      const { state } = entry.offer;
      if (state === "sold") {
        return sameRef(entry.offer.ref, ref)
          ? { status: "unchanged", entry }
          : { status: "skipped", reason: "sold", entry };
      }
      let current = entry;
      if (!isOfferedAt(entry, ref)) {
        if (state !== "held" && state !== "withdrawn") {
          return { status: "skipped", reason: "offered_elsewhere", entry };
        }
        current = (await this.move(entry, STATE_FOR_REF_KIND[ref.kind], ref, actor)).entry;
      }
      return this.move(current, "sold", ref, actor);
    });
  }

  private async resolve(link: RegisterLink | null): Promise<ArtworkRegisterEntry | null> {
    if (!link) return null;
    return "registerId" in link
      ? this.register.findById(link.registerId)
      : this.register.findByZohoProductId(link.zohoProductId);
  }

  /** Reads the entry and applies a change; reads again and retries when another change got in first. */
  private async change(
    link: RegisterLink | null,
    apply: (entry: ArtworkRegisterEntry) => Promise<OfferLockOutcome>,
  ): Promise<OfferLockOutcome> {
    for (let attempt = 1; ; attempt++) {
      const entry = await this.resolve(link);
      if (!entry) return { status: "not_governed" };
      try {
        return await apply(entry);
      } catch (error) {
        if (!(error instanceof VersionConflict)) throw error;
        if (attempt >= MAX_ATTEMPTS) throw new ArtworkOfferMoveError("version_conflict", entry.id);
      }
    }
  }

  private async move(
    entry: ArtworkRegisterEntry,
    to: OfferState,
    ref: OfferRef | null,
    actor: string,
  ): Promise<{ status: "moved"; entry: ArtworkRegisterEntry }> {
    const result = await this.register.moveOffer({
      registerId: entry.id,
      expectedVersion: entry.version,
      to,
      ref,
      actor,
      now: this.now(),
    });
    if (result.ok) return { status: "moved", entry: result.entry };
    if (result.reason === "version_conflict") throw new VersionConflict();
    throw new ArtworkOfferMoveError(result.reason, entry.id);
  }
}
