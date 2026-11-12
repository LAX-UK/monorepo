import type { AuctionDraftLotService } from "./auction-draft-lot.service.js";
import type { LotCatalogueService } from "./lot-catalogue.service.js";
import type { ReturnLotToLaxArtService } from "./return-lot-to-lax-art.service.js";
import type { UnlinkedOriginalsService } from "./unlinked-originals.service.js";

/** Both halves of moving an original between LAX Bid and lax.art, and the switch that governs unlinked ones. */
export type InventoryMoveServices = {
  /** Answers LAX Shop: which sales can take an original, and the draft lot made for it. */
  draftLots: Pick<AuctionDraftLotService, "listSales" | "createDraft" | "findDraft">;
  /** Answers LAX Shop: what the lot holding an artwork says, and a draft lot taking Zoho's changes. */
  lotCatalogue: Pick<LotCatalogueService, "describe" | "updateDraft">;
  /** Staff on a lot that ended unsold, was withdrawn or voided. */
  returnToLaxArt: Pick<ReturnLotToLaxArtService, "describe" | "returnToLaxArt">;
  /** Staff deciding when to stop publishing originals that have no Zoho record. */
  unlinkedOriginals: Pick<UnlinkedOriginalsService, "view" | "setBlockPublishing">;
};
