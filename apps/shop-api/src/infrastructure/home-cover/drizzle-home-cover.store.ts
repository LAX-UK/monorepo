import type { Database } from "@auction/db";
import { shopHomeCover } from "@auction/db/schema";
import { eq, sql } from "drizzle-orm";
import type {
  HomeCoverStore,
  StoredHomeCover,
} from "../../application/home-cover/home-cover.ports.js";

const HOME_ROW = "home";

/** The chosen cover as saved, or null while the home leads with the newest edition. */
export async function readHomeCover(db: Database): Promise<StoredHomeCover | null> {
  const [row] = await db.select().from(shopHomeCover).where(eq(shopHomeCover.id, HOME_ROW));
  if (!row) return null;
  return {
    mediaKey: row.mediaKey,
    width: row.width,
    height: row.height,
    blurDataUrl: row.blurDataUrl,
    focal: { x: row.focalX, y: row.focalY },
    alt: row.alt,
    analysis: row.analysis,
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Reads and writes the cover inside one transaction. */
export function createDrizzleHomeCoverStore(db: Database): HomeCoverStore {
  return {
    read: () => readHomeCover(db),

    async lock() {
      await db.execute(sql`select pg_advisory_xact_lock(hashtext('shop_home_cover'))`);
    },

    async save(record, actorSubjectId, at) {
      const values = {
        mediaKey: record.mediaKey,
        width: record.width,
        height: record.height,
        blurDataUrl: record.blurDataUrl,
        focalX: record.focal.x,
        focalY: record.focal.y,
        alt: record.alt,
        analysis: record.analysis,
        updatedAt: at,
        updatedBySubjectId: actorSubjectId,
      };
      await db
        .insert(shopHomeCover)
        .values({ id: HOME_ROW, ...values })
        .onConflictDoUpdate({ target: shopHomeCover.id, set: values });
    },

    async clear() {
      await db.delete(shopHomeCover).where(eq(shopHomeCover.id, HOME_ROW));
    },
  };
}
