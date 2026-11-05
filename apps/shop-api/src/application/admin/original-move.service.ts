import {
  AUCTION_MOVE_BLOCKER_MESSAGES,
  type ArtworkRegisterEntry,
  InventoryPeerRefusedError,
  InventoryPeerUnavailableError,
  type MoveRecord,
  auctionMoveBlockers,
} from "@auction/artwork-register-contracts";
import type {
  AdminAuctionOfferAssessment,
  AdminAuctionSaleOption,
  AdminOfferAtAuctionResponse,
} from "@auction/shop-contracts";
import { SHOP_API_ERROR_CODES } from "@auction/shop-contracts";
import { ShopDomainError } from "@auction/shop-domain";
import { ShopApiError, notFound } from "../../errors/shop-api-error.js";
import type { AuctionOfferGateway, OriginalMoveReader } from "../ports/original-move.js";

/** The register, as far as a move needs to read it. */
export type MoveRegisterReader = {
  findByZohoProductId(zohoProductId: string): Promise<ArtworkRegisterEntry | null>;
};

/** Where the reason behind a move is kept: the register's history. */
export type MoveHistory = {
  recordMoveConfirmed(input: {
    registerId: string;
    actor: string;
    record: MoveRecord;
    now: Date;
  }): Promise<{ status: "not_found" | "recorded" }>;
};

export type OfferAtAuctionCommand = {
  artworkId: string;
  saleId: string;
  startingPrice: string;
  actorSubjectId: string;
};

const MAX_IMAGES = 20;

/**
 * LAX Shop's half of "Offer at auction". Staff confirm the move; this checks the original may
 * move, asks LAX Bid for a draft lot in the chosen sale, and only then takes the original off
 * lax.art. The draft lot comes first because it changes nothing a buyer can see: if LAX Bid is
 * down or refuses, the listing stays up. If taking the listing down fails after the lot exists,
 * asking again finds that same lot and finishes the job, so nothing is duplicated or stranded.
 * Publishing the draft in LAX Bid is what records the artwork as offered there.
 */
export class OriginalMoveService {
  constructor(
    private readonly deps: {
      originals: OriginalMoveReader;
      register: MoveRegisterReader;
      history: MoveHistory;
      auction: AuctionOfferGateway;
      /** Takes the listing off lax.art and records the withdrawal in the register. */
      withdrawFromLaxArt: (input: { artworkId: string; actorSubjectId: string }) => Promise<void>;
      resolveImageUrl: (value: string | null | undefined) => string | null;
      now?: () => Date;
    },
  ) {}

  /** Whether the original can move to auction now, with the reasons when it cannot. */
  async assess(artworkId: string): Promise<AdminAuctionOfferAssessment> {
    const original = await this.deps.originals.findById(artworkId);
    if (!original) throw notFound("Artwork not found");
    const entry = original.zohoProductId
      ? await this.deps.register.findByZohoProductId(original.zohoProductId)
      : null;
    const blockers = auctionMoveBlockers({
      kind: entry ? (original.runKind === null ? entry.kind : "print") : null,
      offerState: entry?.offer.state ?? null,
      openOriginalSale: original.openOriginalSale,
      markedSold: original.markedSold,
    });
    return {
      artworkId: original.artworkId,
      title: original.title,
      stockCode: entry?.stockCode ?? null,
      onLaxArt: original.onLaxArt,
      eligible: blockers.length === 0,
      reasons: blockers.map((blocker) => AUCTION_MOVE_BLOCKER_MESSAGES[blocker]),
    };
  }

  async listSales(): Promise<AdminAuctionSaleOption[]> {
    return this.viaBid(() => this.deps.auction.listSales());
  }

  async offerAtAuction(command: OfferAtAuctionCommand): Promise<AdminOfferAtAuctionResponse> {
    const assessment = await this.assess(command.artworkId);
    if (!assessment.eligible) throw new ShopDomainError(assessment.reasons.join(" "));
    const original = await this.deps.originals.findById(command.artworkId);
    if (!original?.zohoProductId) throw notFound("Artwork not found");
    const entry = await this.deps.register.findByZohoProductId(original.zohoProductId);
    if (!entry) throw notFound("Artwork not found");

    const sales = await this.listSales();
    const sale = sales.find((candidate) => candidate.id === command.saleId);
    if (!sale) {
      throw new ShopDomainError("That sale is no longer open for new lots. Choose another sale.");
    }

    const actor = `staff:${command.actorSubjectId}`;
    const imageUrls = [original.primaryImageUrl, ...original.imageKeys]
      .map((value) => this.deps.resolveImageUrl(value))
      .filter((url): url is string => url !== null)
      .filter((url, index, all) => all.indexOf(url) === index)
      .slice(0, MAX_IMAGES);

    const draft = await this.viaBid(() =>
      this.deps.auction.createDraftLot({
        registerId: entry.id,
        saleId: command.saleId,
        startingPrice: command.startingPrice,
        actor,
        content: {
          title: original.title,
          artistName: original.artistName,
          medium: original.medium,
          dimensions: original.dimensions,
          year: original.yearCreated,
          description: original.description,
          provenance: original.provenance,
          imageUrls,
        },
      }),
    );

    if (original.onLaxArt) {
      try {
        await this.deps.withdrawFromLaxArt({
          artworkId: original.artworkId,
          actorSubjectId: command.actorSubjectId,
        });
      } catch (error) {
        if (error instanceof ShopDomainError) throw error;
        throw new ShopApiError(
          SHOP_API_ERROR_CODES.INTERNAL,
          `The draft lot is ready in ${sale.title}, but the artwork could not be taken off lax.art. Try again: the same lot is reused.`,
          502,
        );
      }
    }

    await this.deps.history.recordMoveConfirmed({
      registerId: entry.id,
      actor,
      record: {
        direction: "to_auction",
        saleId: draft.saleId,
        lotId: draft.lotId,
        consignorAgreed: true,
        confirmedBy: actor,
      },
      now: (this.deps.now ?? (() => new Date()))(),
    });

    return {
      lotId: draft.lotId,
      saleId: draft.saleId,
      saleTitle: sale.title,
      withdrawnFromLaxArt: original.onLaxArt,
    };
  }

  /** LAX Bid's refusals reach staff in its own words; an outage is a retryable failure. */
  private async viaBid<T>(call: () => Promise<T>): Promise<T> {
    try {
      return await call();
    } catch (error) {
      if (error instanceof InventoryPeerRefusedError) throw new ShopDomainError(error.message);
      if (error instanceof InventoryPeerUnavailableError) {
        throw new ShopApiError(SHOP_API_ERROR_CODES.INTERNAL, error.message, 502);
      }
      throw error;
    }
  }
}
