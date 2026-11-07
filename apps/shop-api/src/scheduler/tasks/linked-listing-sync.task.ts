import type { Database } from "@auction/db";
import type { ArtCacheInvalidator } from "../../application/ports/art-cache-invalidator.js";
import { createLinkedListingSyncRunner } from "../../infrastructure/scheduler/linked-listing-sync.runner.js";
import type { ShopSchedulerTask } from "../shop-scheduler-task.js";

/**
 * Keeps lax.art originals made from Zoho records in step with Zoho. Pictures the Zoho sync stored
 * first get their media records (so they show with a placeholder), then listings take Zoho's
 * values. When something changed, lax.art is told to refresh; if it cannot be told, its own cache
 * expiry is the fallback and the next pass has nothing left to change.
 *
 * `registerMediaAssets` is absent when media storage is not configured; listings still follow.
 */
export function createLinkedListingSyncTask(
  db: Database,
  artCache: ArtCacheInvalidator,
  onCacheError: (error: unknown) => void,
  registerMediaAssets: () => Promise<number> = async () => 0,
): ShopSchedulerTask {
  const sync = createLinkedListingSyncRunner(db);
  return {
    name: "linked-listing-sync",
    run: async (now) => {
      const registered = await registerMediaAssets();
      const result = await sync(now);
      if (registered + result.details + result.images === 0) return;
      await artCache.invalidateCatalogue("artworks").catch(onCacheError);
    },
  };
}
