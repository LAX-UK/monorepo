import {
  type ArtworkOfferLock,
  ArtworkOfferMoveError,
  ArtworkOfferedElsewhereError,
  InventoryPeerRefusedError,
  InventoryPeerUnavailableError,
  RETURN_MOVE_BLOCKER_MESSAGES,
  type ReopenListingAnswer,
  type ReopenListingRequest,
  type ReturnMoveBlocker,
  returnMoveBlockers,
} from "@auction/artwork-register-contracts";
import type {
  IArtworkMoveHistory,
  IArtworkRegisterReader,
  ILotRegisterLinkReader,
  RegisterEvent,
} from "@auction/persistence/interfaces";

/** LAX Shop's half of a return: reopen the artwork's lax.art listing as a draft. */
export type ArtListingGateway = {
  reopen(request: ReopenListingRequest): Promise<ReopenListingAnswer>;
};

export type ReturnToLaxArtView =
  /** The lot offers no register record, so there is nothing to move. */
  | { linked: false }
  | {
      linked: true;
      title: string;
      stockCode: string;
      canReturn: boolean;
      /** Why not, in words for staff. */
      reasons: string[];
    };

/** What staff do when a work that was on lax.art has lost its Shop record. */
const CREATE_FROM_ZOHO_HINT = "Create it from the Zoho record in LAX Admin first.";

/** Said when a return ends in the register alone. */
const REGISTER_ONLY_HINT =
  "This artwork was consigned on LAX Bid and has no lax.art record, so only the register was updated.";

/** Events to read when checking where an artwork has been; a longer history is not trusted. */
const HISTORY_LIMIT = 500;

export type ReturnToLaxArtResult =
  | {
      ok: true;
      reopened: boolean;
      /** False for an artwork consigned on LAX Bid that has no lax.art record to reopen. */
      laxArtListing: boolean;
      /** Why there is no lax.art listing, when there is none. */
      hint?: string;
    }
  | {
      ok: false;
      status: 404 | 409 | 502;
      error: string;
      code: string;
      /** Set when Shop has no listing to reopen for a work that has been on lax.art. */
      laxArtListing?: false;
      hint?: string;
    };

const PLACE_STATE_LAX_ART = "lax_art";
const SHOP_REF_KIND = "shop_artwork";

const placeOf = (value: unknown): { state?: unknown; ref?: { kind?: unknown } | null } =>
  typeof value === "object" && value !== null ? value : {};

/** True when a register event shows the artwork was, or was made ready to be, on lax.art. */
function touchesLaxArt(event: RegisterEvent): boolean {
  const payload = event.payload;
  switch (event.type) {
    case "offer_moved":
      return [placeOf(payload.from), placeOf(payload.to)].some(
        (place) => place.state === PLACE_STATE_LAX_ART || place.ref?.kind === SHOP_REF_KIND,
      );
    case "move_confirmed":
      return Boolean(payload.withdrawnFromLaxArt) || typeof payload.shopArtworkId === "string";
    case "lax_art_draft_created":
    case "zoho_link_linked":
    case "zoho_link_unlinked":
      return true;
    default:
      return false;
  }
}

const messages = (blockers: ReturnMoveBlocker[]): string[] =>
  blockers.map((blocker) => RETURN_MOVE_BLOCKER_MESSAGES[blocker]);

/**
 * LAX Bid's half of "Return to lax.art": for a lot that ended unsold, was withdrawn or voided. The
 * register shows the artwork as withdrawn from this lot, LAX Shop reopens the listing as a draft,
 * and the move is written into the register's history. Staff then publish the draft on lax.art,
 * which is what records the artwork as offered there. Every step is safe to repeat, so a failure
 * part way is cleared by trying again.
 */
export class ReturnLotToLaxArtService {
  constructor(
    private readonly deps: {
      links: ILotRegisterLinkReader;
      register: Pick<IArtworkRegisterReader, "findById" | "listEvents">;
      lock: ArtworkOfferLock;
      shop: ArtListingGateway;
      history: IArtworkMoveHistory;
      now?: () => Date;
    },
  ) {}

  async describe(lotId: string): Promise<ReturnToLaxArtView> {
    const facts = await this.facts(lotId);
    if (!facts) return { linked: false };
    const blockers = returnMoveBlockers(facts.move);
    return {
      linked: true,
      title: facts.entry.title,
      stockCode: facts.entry.stockCode,
      canReturn: blockers.length === 0,
      reasons: messages(blockers),
    };
  }

  async returnToLaxArt(lotId: string, actorUserId: string): Promise<ReturnToLaxArtResult> {
    const facts = await this.facts(lotId);
    if (!facts) {
      return {
        ok: false,
        status: 404,
        code: "no_register_record",
        error: RETURN_MOVE_BLOCKER_MESSAGES.no_register_record,
      };
    }
    const blockers = returnMoveBlockers(facts.move);
    if (blockers.length > 0) {
      return {
        ok: false,
        status: 409,
        code: blockers[0] ?? "elsewhere",
        error: messages(blockers).join(" "),
      };
    }
    const actor = `staff:${actorUserId}`;
    const registerId = facts.entry.id;
    try {
      await this.deps.lock.withdraw({ registerId }, { kind: "bid_lot", id: lotId }, actor);
      const listing = await this.reopenListing(registerId, actor);
      await this.deps.history.recordMoveConfirmed({
        registerId,
        actor,
        record: {
          direction: "to_lax_art",
          lotId,
          ...(listing ? { shopArtworkId: listing.artworkId } : { noLaxArtListing: true }),
          confirmedBy: actor,
        },
        now: (this.deps.now ?? (() => new Date()))(),
      });
      return listing
        ? { ok: true, reopened: listing.reopened, laxArtListing: true }
        : { ok: true, reopened: false, laxArtListing: false, hint: REGISTER_ONLY_HINT };
    } catch (error) {
      return this.failure(error);
    }
  }

  /**
   * Asks LAX Shop to reopen the listing. Shop also answers `no_listing` when a lax.art work's
   * record is missing or its Zoho product is a print run, so that answer ends the return in the
   * register alone (null here) only when the register's history shows the work was never on
   * lax.art. Otherwise the refusal stands and staff are told to create the record first.
   */
  private async reopenListing(
    registerId: string,
    actor: string,
  ): Promise<ReopenListingAnswer | null> {
    try {
      return await this.deps.shop.reopen({ registerId, actor });
    } catch (error) {
      if (
        error instanceof InventoryPeerRefusedError &&
        error.refusal.error === "no_listing" &&
        (await this.neverOnLaxArt(registerId))
      ) {
        return null;
      }
      throw error;
    }
  }

  /** The history holds no sign of lax.art. A history too long to read in full proves nothing. */
  private async neverOnLaxArt(registerId: string): Promise<boolean> {
    const events = await this.deps.register.listEvents(registerId, HISTORY_LIMIT);
    return events.length < HISTORY_LIMIT && !events.some(touchesLaxArt);
  }

  private failure(error: unknown): ReturnToLaxArtResult {
    if (error instanceof InventoryPeerRefusedError) {
      return {
        ok: false,
        status: 409,
        code: error.refusal.error,
        error: error.message,
        ...(error.refusal.error === "no_listing"
          ? { laxArtListing: false as const, hint: CREATE_FROM_ZOHO_HINT }
          : {}),
      };
    }
    if (error instanceof InventoryPeerUnavailableError) {
      return { ok: false, status: 502, code: "inventory_peer_unavailable", error: error.message };
    }
    if (error instanceof ArtworkOfferedElsewhereError || error instanceof ArtworkOfferMoveError) {
      return { ok: false, status: 409, code: error.code, error: error.message };
    }
    throw error;
  }

  private async facts(lotId: string) {
    const link = await this.deps.links.findLink(lotId);
    if (!link) return null;
    const entry = await this.deps.register.findById(link.registerId);
    if (!entry) return null;
    return {
      entry,
      move: {
        registerLinked: true,
        lotStatus: link.status,
        // A lot ATG sold has no LAX winner but is just as sold: it cannot go back to lax.art.
        hasWinner: link.hasWinner || link.soldOnAtg,
        offerState: entry.offer.state,
        offerLotId: entry.offer.ref?.kind === "bid_lot" ? entry.offer.ref.id : null,
        lotId,
      },
    };
  }
}
