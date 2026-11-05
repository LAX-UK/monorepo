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

export type ReturnToLaxArtResult =
  | { ok: true; reopened: boolean }
  | { ok: false; status: 404 | 409 | 502; error: string; code: string };

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
      register: Pick<IArtworkRegisterReader, "findById">;
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
      const listing = await this.deps.shop.reopen({ registerId, actor });
      await this.deps.history.recordMoveConfirmed({
        registerId,
        actor,
        record: {
          direction: "to_lax_art",
          lotId,
          shopArtworkId: listing.artworkId,
          confirmedBy: actor,
        },
        now: (this.deps.now ?? (() => new Date()))(),
      });
      return { ok: true, reopened: listing.reopened };
    } catch (error) {
      return this.failure(error);
    }
  }

  private failure(error: unknown): ReturnToLaxArtResult {
    if (error instanceof InventoryPeerRefusedError) {
      return { ok: false, status: 409, code: error.refusal.error, error: error.message };
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
        hasWinner: link.hasWinner,
        offerState: entry.offer.state,
        offerLotId: entry.offer.ref?.kind === "bid_lot" ? entry.offer.ref.id : null,
        lotId,
      },
    };
  }
}
