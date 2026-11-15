import type { Database } from "@auction/db";
import type { ArtCacheInvalidator } from "../../application/ports/art-cache-invalidator.js";
import { createGallerySaleListingsRunner } from "../../infrastructure/scheduler/gallery-sale-listings.runner.js";
import type { ShopSchedulerTask } from "../shop-scheduler-task.js";

/**
 * Takes a work off lax.art once the register records it as sold in the gallery, every tick. The
 * register only changes when the Zoho sync runs live, so a dry run never reaches this.
 */
export function createGallerySaleListingsTask(
  db: Database,
  artCache: ArtCacheInvalidator,
  onCacheError: (error: unknown) => void,
): ShopSchedulerTask {
  const run = createGallerySaleListingsRunner(db);
  return {
    name: "gallery-sale-listings",
    run: async (now) => {
      const { unpublished } = await run(now);
      if (unpublished === 0) return;
      await artCache.invalidateCatalogue("artworks").catch(onCacheError);
    },
  };
}
