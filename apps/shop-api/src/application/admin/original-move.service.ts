import {
  type ArtworkRegisterEntry,
  BID_NOT_CONNECTED_MESSAGE,
  type DraftLotContent,
  InventoryPeerRefusedError,
  InventoryPeerUnavailableError,
  type LockMessage,
  type MoveRecord,
  auctionOfferBlockers,
} from "@auction/artwork-register-contracts";
import type {
  AdminAuctionOfferAssessment,
  AdminAuctionSaleOption,
  AdminOfferAtAuctionResponse,
} from "@auction/shop-contracts";
import { SHOP_API_ERROR_CODES } from "@auction/shop-contracts";
import { ShopDomainError } from "@auction/shop-domain";
import { ShopApiError, notFound } from "../../errors/shop-api-error.js";
import type {
  AuctionOfferGateway,
  OriginalForMove,
  OriginalMoveReader,
} from "../ports/original-move.js";

/** The register, as far as a move needs to read it. */
export type MoveRegisterReader = {
  findById(id: string): Promise<ArtworkRegisterEntry | null>;
  findByZohoProductId(zohoProductId: string): Promise<ArtworkRegisterEntry | null>;
};

/** Where the reason behind a move is kept: the register's history. */
export type MoveHistory = {
  recordMoveConfirmed(input: {
    registerId: string;
    actor: string;
    record: MoveRecord;
    now: Date;
  }): Promise<{ status: "not_found" | "recorded" | "already_recorded" }>;
};

/** Staff choose the sale and price; who confirmed is the person acting. */
export type OfferAtAuctionTerms = {
  saleId: string;
  startingPrice: string;
  actorSubjectId: string;
};

export type OfferAtAuctionCommand = OfferAtAuctionTerms & { artworkId: string };
export type OfferRegisterAtAuctionCommand = OfferAtAuctionTerms & { registerId: string };

const MAX_IMAGES = 20;

/** Where an artwork stands for a move: its register record, and the lax.art listing if it has one. */
type MoveSubject = { entry: ArtworkRegisterEntry; original: OriginalForMove | null };

const NOT_IN_REGISTER: LockMessage = {
  reason: "not_linked",
  message:
    "This artwork is not in the artwork register yet, so it cannot be moved. Link it to its Zoho record first.",
  link: { label: "Link to Zoho record…", target: "link_to_zoho" },
};

/**
 * LAX Shop's half of "Offer at auction". It starts from an original's lax.art page or from its
 * record in the artwork register; both reach the same steps. It checks the original may move, asks
 * LAX Bid for a draft lot in the chosen sale, and only then takes a live lax.art listing down. The
 * draft lot comes first because it changes nothing a buyer can see: if LAX Bid is down or refuses,
 * the listing stays up. If taking the listing down fails after the lot exists, asking again finds
 * that same lot and finishes the job, so nothing is duplicated or stranded. A record with no
 * lax.art listing has nothing to take down: the lot is filled from Zoho's details. Publishing the
 * draft in LAX Bid is what records the artwork as offered there.
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
    const entry = await this.entryOf(original);
    if (!entry) {
      return this.assessment({
        original,
        entry: null,
        draftLot: null,
        blockers: [NOT_IN_REGISTER],
      });
    }
    return this.assessSubject({ entry, original });
  }

  /** The same check for a record in the register, whether or not lax.art lists it. */
  async assessRegister(registerId: string): Promise<AdminAuctionOfferAssessment> {
    return this.assessSubject(await this.subjectOfRegister(registerId));
  }

  /** The sales that can take a new lot; `connected` is false while LAX Bid is not set up here. */
  async listSales(): Promise<{ connected: boolean; sales: AdminAuctionSaleOption[] }> {
    try {
      return { connected: true, sales: await this.viaBid(() => this.deps.auction.listSales()) };
    } catch (error) {
      if (error instanceof ShopDomainError && error.message === BID_NOT_CONNECTED_MESSAGE) {
        return { connected: false, sales: [] };
      }
      throw error;
    }
  }

  async offerAtAuction(command: OfferAtAuctionCommand): Promise<AdminOfferAtAuctionResponse> {
    const original = await this.deps.originals.findById(command.artworkId);
    if (!original) throw notFound("Artwork not found");
    const entry = await this.entryOf(original);
    if (!entry) throw new ShopDomainError(NOT_IN_REGISTER.message);
    return this.move({ entry, original }, command);
  }

  /** Offers a register record at auction, with or without a lax.art listing. */
  async offerRegisterAtAuction(
    command: OfferRegisterAtAuctionCommand,
  ): Promise<AdminOfferAtAuctionResponse> {
    return this.move(await this.subjectOfRegister(command.registerId), command);
  }

  private async entryOf(original: OriginalForMove): Promise<ArtworkRegisterEntry | null> {
    return original.zohoProductId
      ? this.deps.register.findByZohoProductId(original.zohoProductId)
      : null;
  }

  private async subjectOfRegister(registerId: string): Promise<MoveSubject> {
    const entry = await this.deps.register.findById(registerId);
    if (!entry) throw notFound("Artwork not found");
    const original = await this.deps.originals.findByZohoProductId(entry.zohoProductId);
    return { entry, original };
  }

  /** A listing that is an edition run's print is a print, whatever the record says. */
  private static kindOf({ entry, original }: MoveSubject): ArtworkRegisterEntry["kind"] {
    return original && original.runKind !== null ? "print" : entry.kind;
  }

  private static blockersOf(subject: MoveSubject): LockMessage[] {
    const { entry, original } = subject;
    return auctionOfferBlockers(
      { ...entry, kind: OriginalMoveService.kindOf(subject) },
      original
        ? {
            live: original.onLaxArt,
            markedSold: original.markedSold,
            openOriginalSale: original.openOriginalSale,
          }
        : null,
    );
  }

  private async assessSubject(subject: MoveSubject): Promise<AdminAuctionOfferAssessment> {
    const blockers = OriginalMoveService.blockersOf(subject);
    // The lot LAX Bid already holds is shown, not asked for again; an outage hides it, no more.
    const { state } = subject.entry.offer;
    const mayHoldDraft = blockers.length === 0 || state === "held" || state === "withdrawn";
    const draftLot = mayHoldDraft
      ? await this.deps.auction.findDraftLot(subject.entry.id).catch(() => null)
      : null;
    return this.assessment({ ...subject, draftLot, blockers });
  }

  private assessment(input: {
    original: OriginalForMove | null;
    entry: ArtworkRegisterEntry | null;
    draftLot: { lotId: string; saleTitle: string | null } | null;
    blockers: readonly LockMessage[];
  }): AdminAuctionOfferAssessment {
    const { original, entry, draftLot, blockers } = input;
    const offer = entry?.offer;
    return {
      registerId: entry?.id ?? null,
      artworkId: original?.artworkId ?? null,
      title: original?.title ?? entry?.title ?? "",
      stockCode: entry?.stockCode ?? null,
      onLaxArt: original?.onLaxArt ?? false,
      laxArtDraft: original !== null && !original.onLaxArt && !original.archived,
      draftLot: draftLot ? { lotId: draftLot.lotId, saleTitle: draftLot.saleTitle } : null,
      holdingLotId:
        offer?.state === "bid_sale" && offer.ref?.kind === "bid_lot" ? offer.ref.id : null,
      eligible: blockers.length === 0,
      blockers: blockers.map(({ message, link }) => ({ message, link })),
    };
  }

  /** What lax.art says about the artwork where it has a listing; Zoho's details otherwise. */
  private contentOf({ entry, original }: MoveSubject): DraftLotContent {
    const keys = original
      ? [original.primaryImageUrl, ...original.imageKeys]
      : (entry.imageRefs as Array<string | null>);
    const imageUrls = keys
      .map((value) => this.deps.resolveImageUrl(value))
      .filter((url): url is string => url !== null)
      .filter((url, index, all) => all.indexOf(url) === index)
      .slice(0, MAX_IMAGES);
    return {
      title: original?.title ?? entry.title,
      artistName: original?.artistName ?? entry.artist.name,
      medium: original?.medium ?? entry.medium,
      dimensions: original?.dimensions ?? entry.dimensions,
      year: original?.yearCreated ?? entry.year,
      description: original?.description ?? null,
      provenance: original?.provenance ?? null,
      imageUrls,
    };
  }

  private async move(
    subject: MoveSubject,
    terms: OfferAtAuctionTerms,
  ): Promise<AdminOfferAtAuctionResponse> {
    const { entry, original } = subject;
    const blockers = OriginalMoveService.blockersOf(subject);
    if (blockers.length > 0) {
      throw new ShopDomainError(blockers.map((blocker) => blocker.message).join(" "));
    }

    const { sales } = await this.listSales();
    const sale = sales.find((candidate) => candidate.id === terms.saleId);
    if (!sale) {
      throw new ShopDomainError("That sale is no longer open for new lots. Choose another sale.");
    }

    const actor = `staff:${terms.actorSubjectId}`;
    const draft = await this.viaBid(() =>
      this.deps.auction.createDraftLot({
        registerId: entry.id,
        saleId: terms.saleId,
        startingPrice: terms.startingPrice,
        actor,
        content: this.contentOf(subject),
      }),
    );

    const takenDown = original?.onLaxArt === true;
    if (original && takenDown) {
      try {
        await this.deps.withdrawFromLaxArt({
          artworkId: original.artworkId,
          actorSubjectId: terms.actorSubjectId,
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

    // Recording is idempotent per lot, so a retry or a second click leaves one entry.
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
      withdrawnFromLaxArt: takenDown,
      created: draft.created,
    };
  }

  /** LAX Bid's refusals reach staff in its own words; an outage is a retryable failure. */
  private async viaBid<T>(call: () => Promise<T>): Promise<T> {
    try {
      return await call();
    } catch (error) {
      if (error instanceof InventoryPeerRefusedError) {
        throw new ShopDomainError(error.message);
      }
      if (error instanceof InventoryPeerUnavailableError) {
        throw new ShopApiError(
          SHOP_API_ERROR_CODES.INTERNAL,
          "LAX Bid could not be reached. Try again in a moment.",
          502,
        );
      }
      throw error;
    }
  }
}
