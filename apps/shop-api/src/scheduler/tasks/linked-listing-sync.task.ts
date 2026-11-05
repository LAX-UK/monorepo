import type { Database } from "@auction/db";
import type { ArtCacheInvalidator } from "../../application/ports/art-cache-invalidator.js";
import { createLinkedListingSyncRunner } from "../../infrastructure/scheduler/linked-listing-sync.runner.js";
import type { ShopSchedulerTask } from "../shop-scheduler-task.js";

/**
 * Keeps lax.art originals made from Zoho records in step with Zoho. When something changed, lax.art
 * is told to refresh; if it cannot be told, its own cache expiry is the fallback and the next
 * pass has nothing left to change.
 */
export function createLinkedListingSyncTask(
  db: Database,
  artCache: ArtCacheInvalidator,
  onCacheError: (error: unknown) => void,
): ShopSchedulerTask {
  const sync = createLinkedListingSyncRunner(db);
  return {
    name: "linked-listing-sync",
    run: async (now) => {
      const result = await sync(now);
      if (result.details + result.images === 0) return;
      await artCache.invalidateCatalogue("artworks").catch(onCacheError);
    },
  };
}
