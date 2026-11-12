import type { ArtworkRegisterEntry } from "@auction/artwork-register-contracts";
import type { Database } from "@auction/db";
import { shopArtwork } from "@auction/db/schema";
import { eq } from "drizzle-orm";
import { laxArtCatalogueChange } from "../application/artwork-register/catalogue-change.js";
import {
  CatalogueCopyRefusedError,
  type LaxArtCatalogueCopy,
  type LaxArtCatalogueCopyStore,
} from "../application/ports/catalogue-change.ports.js";
import type { ShopUnitOfWorkFactory } from "../application/ports/shop-unit-of-work.js";
import { shopPhaseDbSession } from "./drizzle-shop-transaction-effects.js";
import { readListingFacts, writeListingUpdate } from "./drizzle-zoho-link.js";

const listingColumns = {
  id: shopArtwork.id,
  title: shopArtwork.title,
  medium: shopArtwork.medium,
  dimensions: shopArtwork.dimensions,
  year: shopArtwork.yearCreated,
  artistId: shopArtwork.artistId,
  publishedAt: shopArtwork.publishedAt,
  archivedAt: shopArtwork.archivedAt,
};

/** Reads and updates the lax.art listing a register record was made from or linked to. */
export function createDrizzleLaxArtCatalogueCopyStore(
  db: Database,
  uow: ShopUnitOfWorkFactory,
  options: {
    register: { findByZohoProductId(zohoProductId: string): Promise<ArtworkRegisterEntry | null> };
    now?: () => Date;
  },
): LaxArtCatalogueCopyStore {
  const clock = options.now ?? (() => new Date());

  async function copyOf(
    session: Database,
    zohoProductId: string,
    entry: { artist: { code: string } },
    lock: boolean,
  ): Promise<(LaxArtCatalogueCopy & { artistId: string; archived: boolean }) | null> {
    const query = session
      .select(listingColumns)
      .from(shopArtwork)
      .where(eq(shopArtwork.zohoProductId, zohoProductId))
      .limit(1);
    const [row] = lock ? await query.for("update") : await query;
    if (!row) return null;
    const { facts, artistForCode } = await readListingFacts(session, row, entry);
    return {
      artworkId: row.id,
      published: row.publishedAt !== null,
      archived: row.archivedAt !== null,
      artistId: row.artistId,
      facts,
      artistForCode,
    };
  }

  return {
    async read(zohoProductId) {
      const entry = await options.register.findByZohoProductId(zohoProductId);
      if (!entry) return null;
      const copy = await copyOf(db, zohoProductId, entry, false);
      if (!copy || copy.archived) return null;
      const { artworkId, published, facts, artistForCode } = copy;
      return { artworkId, published, facts, artistForCode };
    },

    async updateDraft(command) {
      return uow.run(async (tx) => {
        const session = shopPhaseDbSession(tx);
        const { entry } = command;
        const copy = await copyOf(session, entry.zohoProductId, entry, true);
        if (!copy || copy.archived) {
          throw new CatalogueCopyRefusedError("There is no lax.art listing for this artwork.");
        }
        // Re-checked under the row lock: staff may have published it since the page was drawn.
        if (copy.published) {
          throw new CatalogueCopyRefusedError(
            "This listing is live on lax.art, so it is not changed from Zoho automatically.",
          );
        }
        const result = laxArtCatalogueChange(copy, entry);
        if (!result) return { updated: [] };
        const { plan } = result;
        if (plan.artistRefusal) throw new CatalogueCopyRefusedError(plan.artistRefusal);

        await writeListingUpdate(session, {
          listingId: copy.artworkId,
          artistId: copy.artistId,
          update: plan.update,
          now: clock(),
        });
        const before = { ...copy.facts };
        await tx.audit.append({
          actorSubjectId: command.actorSubjectId,
          capability: "artwork_register.review",
          action: "zoho_catalogue_update",
          targetType: "shop_artwork",
          targetId: copy.artworkId,
          beforeJson: before,
          afterJson: { registerId: entry.id, stockCode: entry.stockCode, updated: plan.replaced },
        });
        return { updated: plan.differences.map((difference) => difference.label) };
      });
    },
  };
}
