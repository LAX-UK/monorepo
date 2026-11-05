import type { AuctionDraftLotService } from "./auction-draft-lot.service.js";
import type { ReturnLotToLaxArtService } from "./return-lot-to-lax-art.service.js";

/** Both halves of moving an original between LAX Bid and lax.art, as LAX Bid owns them. */
export type InventoryMoveServices = {
  /** Answers LAX Shop: which sales can take an original, and the draft lot made for it. */
  draftLots: Pick<AuctionDraftLotService, "listSales" | "createDraft">;
  /** Staff on a lot that ended unsold, was withdrawn or voided. */
  returnToLaxArt: Pick<ReturnLotToLaxArtService, "describe" | "returnToLaxArt">;
};
