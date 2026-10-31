/**
 * Gives every artist without a portrait the lead image of one of their own works, so lax.art's
 * artist pages and cards show the artist's work instead of an initials placeholder. Used on demo
 * and test environments where the imported artists came without portraits.
 *
 * Idempotent: only artists whose portrait is empty change, and an artist with no imaged work is
 * left as it is. Run again after more works are imported.
 */
import { closeDb, createDb } from "@auction/db";
import { sql } from "drizzle-orm";
import { loadShopApiEnv } from "../env.js";

const env = loadShopApiEnv();
if (env.NODE_ENV === "production" && !process.argv.includes("--force")) {
  console.error("Refusing to set artist portraits in production without --force");
  process.exit(1);
}

const db = createDb(env.DATABASE_URL_SHOP);
try {
  const result = await db.execute(sql`
    update shop_artist artist
    set portrait_image_url = lead.media_key
    from (
      select distinct on (work.artist_id) work.artist_id, image.media_key
      from shop_artwork work
      join shop_artwork_image image on image.artwork_id = work.id
      order by work.artist_id, work.created_at, image.position
    ) lead
    where lead.artist_id = artist.id
      and artist.portrait_image_url is null
  `);
  console.log(`shop-api: gave ${result.rowCount ?? 0} artist(s) a portrait from their own work`);
} finally {
  await closeDb(db);
}
