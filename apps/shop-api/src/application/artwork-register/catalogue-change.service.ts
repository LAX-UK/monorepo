import { InventoryPeerRefusedError } from "@auction/artwork-register-contracts";
import type { ArtworkRegisterEntry } from "@auction/artwork-register-contracts";
import type {
  AdminCatalogueChange,
  AdminCatalogueCopy,
  AdminCatalogueUpdateResponse,
} from "@auction/shop-contracts";
import { ShopDomainError } from "@auction/shop-domain";
import { notFound } from "../../errors/shop-api-error.js";
import type { ArtworkRegisterRecords } from "../ports/artwork-register-review.ports.js";
import {
  CatalogueCopyRefusedError,
  type LaxArtCatalogueCopyStore,
} from "../ports/catalogue-change.ports.js";
import type { AuctionOfferGateway } from "../ports/original-move.js";
import type { ShopAdminAuditWriter } from "../ports/shop-admin-audit.writer.js";
import {
  bidLotCatalogueChange,
  bidLotContent,
  bidLotIsDraft,
  laxArtCatalogueChange,
  zohoImageUrls,
} from "./catalogue-change.js";

export type CatalogueChangeDeps = {
  register: Pick<ArtworkRegisterRecords, "findById">;
  laxArt: LaxArtCatalogueCopyStore;
  /** LAX Bid's lot catalogue. Asking can fail; the page then reads as if the lot matched. */
  bid: Pick<AuctionOfferGateway, "findLotCatalogue" | "updateLotCatalogue">;
  resolveImageUrl: (value: string | null | undefined) => string | null;
  /** Where an update to a Bid lot is recorded: the lax.art update records itself in its own transaction. */
  audit: ShopAdminAuditWriter;
};

/**
 * "Zoho changed since it was listed". Zoho owns an artwork's title, artist, medium, size, year
 * and pictures; the register follows Zoho, but the lax.art listing and the Bid lot made from the
 * record keep what they took. This shows where those copies differ and, for a draft only, brings
 * them up to date in one step. A published lax.art listing and a lot in a live or upcoming sale
 * are never changed here, however the request is made: staff decide.
 */
export class CatalogueChangeService {
  constructor(private readonly deps: CatalogueChangeDeps) {}

  /** Every copy of the record that no longer matches Zoho; empty when all match. */
  async changesFor(entry: ArtworkRegisterEntry): Promise<AdminCatalogueChange[]> {
    const [laxArt, bid] = await Promise.all([this.laxArtChange(entry), this.bidChange(entry)]);
    return [laxArt, bid].filter((change): change is AdminCatalogueChange => change !== null);
  }

  async update(input: {
    registerId: string;
    copy: AdminCatalogueCopy;
    actorSubjectId: string;
  }): Promise<AdminCatalogueUpdateResponse> {
    const entry = await this.deps.register.findById(input.registerId);
    if (!entry) throw notFound("Artwork");
    const updated =
      input.copy === "lax_art"
        ? await this.updateLaxArt(entry, input.actorSubjectId)
        : await this.updateBidLot(entry, input.actorSubjectId);
    return { copy: input.copy, updated };
  }

  /** The lax.art listing's change, for the artwork's own page. */
  async laxArtChange(entry: ArtworkRegisterEntry): Promise<AdminCatalogueChange | null> {
    const copy = await this.deps.laxArt.read(entry.zohoProductId);
    return copy ? (laxArtCatalogueChange(copy, entry)?.change ?? null) : null;
  }

  private async bidChange(entry: ArtworkRegisterEntry): Promise<AdminCatalogueChange | null> {
    // Only an original can be in a Bid sale, and only once it has been offered there.
    if (entry.kind !== "original") return null;
    const lot = await this.deps.bid.findLotCatalogue(entry.id).catch(() => null);
    if (!lot) return null;
    return bidLotCatalogueChange(lot, entry, zohoImageUrls(entry, this.deps.resolveImageUrl));
  }

  private async updateLaxArt(entry: ArtworkRegisterEntry, actorSubjectId: string) {
    try {
      const result = await this.deps.laxArt.updateDraft({
        zohoProductId: entry.zohoProductId,
        entry,
        actorSubjectId,
      });
      return result.updated;
    } catch (error) {
      if (error instanceof CatalogueCopyRefusedError) throw new ShopDomainError(error.message);
      throw error;
    }
  }

  private async updateBidLot(entry: ArtworkRegisterEntry, actorSubjectId: string) {
    const lot = await this.deps.bid.findLotCatalogue(entry.id);
    if (!lot) throw new ShopDomainError("This artwork has no lot in LAX Bid.");
    // Checked here as well as in LAX Bid, so the refusal reads the same wherever it is made.
    if (!bidLotIsDraft(lot)) {
      throw new ShopDomainError(
        "This lot is in a sale that is live or coming up, so it is not changed from Zoho. Edit the lot in LAX Bid if it should match.",
      );
    }
    const imageUrls = zohoImageUrls(entry, this.deps.resolveImageUrl);
    const change = bidLotCatalogueChange(lot, entry, imageUrls);
    if (!change) return [];
    try {
      await this.deps.bid.updateLotCatalogue(entry.id, {
        actor: `staff:${actorSubjectId}`,
        content: bidLotContent(entry, imageUrls),
      });
    } catch (error) {
      if (error instanceof InventoryPeerRefusedError) throw new ShopDomainError(error.message);
      throw error;
    }
    const updated = change.comparison.filter((row) => row.changes).map((row) => row.label);
    await this.deps.audit.append({
      actorSubjectId,
      capability: "artwork_register.review",
      action: "zoho_catalogue_update",
      targetType: "bid_lot",
      targetId: lot.lotId,
      beforeJson: {
        title: lot.title,
        medium: lot.medium,
        dimensions: lot.dimensions,
        imageCount: lot.imageUrls.length,
      },
      afterJson: { registerId: entry.id, stockCode: entry.stockCode, updated },
    });
    return updated;
  }
}
