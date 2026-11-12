import type {
  AuctionSaleOption,
  DraftLotAnswer,
  DraftLotRequest,
  DraftLotSummary,
  LotCatalogueFacts,
  LotCatalogueUpdateAnswer,
  LotCatalogueUpdateRequest,
} from "@auction/artwork-register-contracts";

/** What lax.art holds about an original that a move needs: its facts, and where it stands. */
export type OriginalForMove = {
  artworkId: string;
  title: string;
  artistName: string;
  description: string | null;
  provenance: string | null;
  medium: string | null;
  dimensions: string | null;
  yearCreated: number | null;
  /** Gallery image keys in order; the cover is the first. */
  imageKeys: string[];
  primaryImageUrl: string | null;
  zohoProductId: string | null;
  salesChannel: "shop" | "art";
  /** Set for an edition's print run; null for an original. */
  runKind: string | null;
  markedSold: boolean;
  /** Published and not archived: visible on lax.art now. */
  onLaxArt: boolean;
  archived: boolean;
  /** A buyer holds a reservation, deposit, invoice or payment on this original. */
  openOriginalSale: boolean;
};

export interface OriginalMoveReader {
  findById(artworkId: string): Promise<OriginalForMove | null>;
  /** The lax.art original for a register record, by the Zoho Product id it holds. */
  findByZohoProductId(zohoProductId: string): Promise<OriginalForMove | null>;
}

/** LAX Bid's half of a move to auction. Errors are `InventoryPeer*Error`. */
export interface AuctionOfferGateway {
  listSales(): Promise<AuctionSaleOption[]>;
  createDraftLot(request: DraftLotRequest): Promise<DraftLotAnswer>;
  /** The draft lot LAX Bid holds for a register record, if any. */
  findDraftLot(registerId: string): Promise<DraftLotSummary | null>;
  /** What the lot holding a register record's place says, to compare with Zoho; null when none does. */
  findLotCatalogue(registerId: string): Promise<LotCatalogueFacts | null>;
  /** Gives a draft lot Zoho's details. LAX Bid refuses (`lot_not_draft`) for anything but a draft. */
  updateLotCatalogue(
    registerId: string,
    request: LotCatalogueUpdateRequest,
  ): Promise<LotCatalogueUpdateAnswer>;
}
