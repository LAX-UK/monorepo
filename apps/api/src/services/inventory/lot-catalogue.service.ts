import type {
  LotCatalogueFacts,
  LotCatalogueUpdateAnswer,
  LotCatalogueUpdateRequest,
} from "@auction/artwork-register-contracts";
import type { IAuctionOfferReader } from "@auction/persistence/interfaces";
import type { CreateLotInput, Lot } from "@auction/types";
import type { Result } from "neverthrow";
import type { AuthzError, LotError } from "../../lib/errors.js";
import type { InventoryOutcome } from "./auction-draft-lot.service.js";

/** What this service needs to change a lot; the lot service is the only place lots are changed. */
export type DraftLotEditor = {
  update(
    userRole: string,
    lotId: string,
    input: Partial<CreateLotInput>,
  ): Promise<Result<Lot, LotError | AuthzError>>;
};

/** The machine acts with the authority of the staff who asked in LAX Admin. */
const MACHINE_ROLE = "admin";

/** A sale in these states is live or about to be: its lots never change from Zoho. */
const EDITABLE_SALE_STATUS = "draft";

/**
 * LAX Bid's half of "Zoho changed since it was listed". Admin asks what the lot holding an
 * artwork's place says, to compare it with Zoho, and may ask a draft lot to take Zoho's title,
 * medium, size and images. Only a draft lot in a sale that has not started is ever changed: a lot
 * that is scheduled or live (or whose sale is) is left exactly as it is, and the refusal says so.
 */
export class LotCatalogueService {
  constructor(private readonly deps: { offers: IAuctionOfferReader; lots: DraftLotEditor }) {}

  async describe(registerId: string): Promise<LotCatalogueFacts | null> {
    const lot = await this.deps.offers.findLotCatalogueForRegister(registerId);
    if (!lot) return null;
    return {
      lotId: lot.lotId,
      status: lot.status,
      saleStatus: lot.saleStatus,
      title: lot.title,
      medium: lot.medium,
      dimensions: lot.dimensions,
      imageUrls: lot.images,
    };
  }

  async updateDraft(
    registerId: string,
    request: LotCatalogueUpdateRequest,
  ): Promise<InventoryOutcome<LotCatalogueUpdateAnswer>> {
    const lot = await this.deps.offers.findLotCatalogueForRegister(registerId);
    if (!lot) {
      return {
        ok: false,
        status: 404,
        refusal: { error: "no_listing", message: "This artwork has no lot in LAX Bid." },
      };
    }
    if (
      lot.status !== "draft" ||
      (lot.saleStatus !== null && lot.saleStatus !== EDITABLE_SALE_STATUS)
    ) {
      return {
        ok: false,
        status: 409,
        refusal: {
          error: "lot_not_draft",
          message:
            "This lot is no longer a draft in a sale that has not started, so it is not changed from Zoho. Edit it in LAX Bid if it should change.",
        },
      };
    }
    const { content } = request;
    const result = await this.deps.lots.update(MACHINE_ROLE, lot.lotId, {
      title: content.title,
      medium: content.medium ?? "",
      dimensions: content.dimensions ?? "",
      images: content.imageUrls,
    });
    if (result.isErr()) {
      return {
        ok: false,
        status: 409,
        refusal: { error: "lot_not_draft", message: result.error.message },
      };
    }
    return { ok: true, data: { lotId: lot.lotId } };
  }
}
