import {
  type AuctionSaleOption,
  type DraftLotAnswer,
  type DraftLotRequest,
  type MoveRefusal,
  type MoveRefusalCode,
  offerRefusalMessage,
  offerRefusalReason,
} from "@auction/artwork-register-contracts";
import type { IArtworkRegisterReader, IAuctionOfferReader } from "@auction/persistence/interfaces";
import type { ArtistSearchHit } from "@auction/persistence/interfaces";
import type { CreateLotInput, Lot } from "@auction/types";
import type { Result } from "neverthrow";
import type { LotError } from "../../lib/errors.js";

/** What this service needs to make a lot; the lot service is the only place lots are created. */
export type DraftLotCreator = {
  create(sellerId: string, input: CreateLotInput): Promise<Result<Lot, LotError>>;
};

export type ArtistMatcher = {
  search(query: string, limit?: number): Promise<ArtistSearchHit[]>;
};

export type InventoryOutcome<T> =
  | { ok: true; data: T }
  | { ok: false; status: 404 | 409 | 503; refusal: MoveRefusal };

const refuse = (
  status: 404 | 409 | 503,
  error: MoveRefusalCode,
  message: string,
): { ok: false; status: 404 | 409 | 503; refusal: MoveRefusal } => ({
  ok: false,
  status,
  refusal: { error, message },
});

/** A lot that holds the artwork's place in a sale when a second one is made for the same record. */
function isOpenLotConflict(error: unknown): boolean {
  const text = error instanceof Error ? `${error.message} ${String(error.cause ?? "")}` : "";
  return text.includes("lot_artwork_register_open_uid");
}

function composeDescription(content: DraftLotRequest["content"]): string | null {
  const parts = [content.description, content.year ? `Made in ${content.year}.` : null].filter(
    (part): part is string => Boolean(part?.trim()),
  );
  return parts.length > 0 ? parts.join("\n\n") : null;
}

/**
 * LAX Bid's half of "Offer at auction": a draft lot for an original, pre-filled from what lax.art
 * knows, in a sale that has not started. The lot is a draft: staff finish it and publish it in
 * LAX Bid, and publishing is what records the artwork as offered here. Asking again for the same
 * sale returns the draft that is already there.
 */
export class AuctionDraftLotService {
  constructor(
    private readonly deps: {
      offers: IAuctionOfferReader;
      register: Pick<IArtworkRegisterReader, "findById">;
      lots: DraftLotCreator;
      artists: ArtistMatcher;
      /** LAX's own seller account; null when none is set up. */
      resolveHouseSellerLegalEntityId: () => Promise<string | null>;
      now?: () => Date;
    },
  ) {}

  private now(): Date {
    return (this.deps.now ?? (() => new Date()))();
  }

  async listSales(): Promise<AuctionSaleOption[]> {
    const sales = await this.deps.offers.listSalesOpenForOffer(this.now());
    return sales.map((sale) => ({
      id: sale.id,
      title: sale.title,
      startsAt: sale.startsAt.toISOString(),
    }));
  }

  async createDraft(request: DraftLotRequest): Promise<InventoryOutcome<DraftLotAnswer>> {
    const entry = await this.deps.register.findById(request.registerId);
    if (!entry) {
      return refuse(404, "register_not_found", "This artwork is not in the artwork register.");
    }
    if (entry.kind !== "original") {
      return refuse(409, "artwork_offered_elsewhere", "Only originals can be offered at auction.");
    }
    const { state } = entry.offer;
    if (state === "sold" || state === "private_sale") {
      const reason = offerRefusalReason(entry.offer);
      return refuse(409, "artwork_offered_elsewhere", offerRefusalMessage(reason, state));
    }

    const existing = await this.deps.offers.findOpenLotForRegister(entry.id);
    if (existing) {
      if (existing.saleId === request.saleId) {
        return {
          ok: true,
          data: { lotId: existing.lotId, saleId: request.saleId, created: false },
        };
      }
      return refuse(
        409,
        "already_drafted",
        "This artwork already has a lot in another LAX Bid sale. Delete or withdraw that lot first.",
      );
    }

    const sales = await this.deps.offers.listSalesOpenForOffer(this.now());
    const target = sales.find((sale) => sale.id === request.saleId);
    if (!target) {
      return refuse(
        409,
        "sale_not_open",
        "That sale is no longer open for new lots. Choose another sale.",
      );
    }

    const sellerId = await this.deps.resolveHouseSellerLegalEntityId();
    if (!sellerId) {
      return refuse(
        503,
        "not_configured",
        "LAX Bid has no house seller account set up yet, so it cannot make lots from the register.",
      );
    }

    const created = await this.createLot(request, sellerId, target.startsAt, target.endsAt);
    if (created.kind === "conflict") {
      const winner = await this.deps.offers.findOpenLotForRegister(entry.id);
      if (winner && winner.saleId === request.saleId) {
        return { ok: true, data: { lotId: winner.lotId, saleId: request.saleId, created: false } };
      }
      return refuse(
        409,
        "already_drafted",
        "This artwork already has a lot in another LAX Bid sale. Delete or withdraw that lot first.",
      );
    }
    if (created.kind === "refused") return refuse(409, "sale_not_open", created.message);
    return { ok: true, data: { lotId: created.lot.id, saleId: request.saleId, created: true } };
  }

  private async artistIdFor(name: string): Promise<string | undefined> {
    const hits = await this.deps.artists.search(name, 5);
    const exact = hits.filter(
      (hit) => hit.displayName.trim().toLowerCase() === name.trim().toLowerCase(),
    );
    return exact.length === 1 ? exact[0]?.id : undefined;
  }

  private async createLot(
    request: DraftLotRequest,
    sellerId: string,
    startTime: Date,
    endTime: Date,
  ): Promise<
    { kind: "created"; lot: Lot } | { kind: "refused"; message: string } | { kind: "conflict" }
  > {
    const { content } = request;
    const artistId = await this.artistIdFor(content.artistName);
    const description = composeDescription(content);
    const input: CreateLotInput = {
      title: content.title,
      ...(description ? { description } : {}),
      ...(content.medium ? { medium: content.medium } : {}),
      ...(content.dimensions ? { dimensions: content.dimensions } : {}),
      images: content.imageUrls,
      sellerLegalEntityId: sellerId,
      ...(artistId ? { artistId } : {}),
      artworkRegisterId: request.registerId,
      auctionType: "english",
      startingPrice: request.startingPrice,
      startTime,
      endTime,
      saleId: request.saleId,
      marketingDetails: {
        ...(content.provenance ? { provenance: [{ note: content.provenance }] } : {}),
        ...(artistId ? {} : { artistNote: content.artistName }),
      },
    };
    try {
      const result = await this.deps.lots.create(sellerId, input);
      if (result.isErr()) return { kind: "refused", message: result.error.message };
      return { kind: "created", lot: result.value };
    } catch (error) {
      if (isOpenLotConflict(error)) return { kind: "conflict" };
      throw error;
    }
  }
}
