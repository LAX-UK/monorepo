/**
 * Fills the gaps a meeting demo of lax.art and LAX Shop shows: every artist has a portrait, every
 * story, exhibition and venue has a cover picture, and the seeded originals cover each sale
 * state (for sale, price on request, sold). Pictures are the repo's own seed assets.
 *
 * Idempotent: it only fills empty pictures and sets fixed states, and never deletes. Test and
 * local databases only.
 */
import type { Database } from "@auction/db";
import { sql } from "drizzle-orm";

const COVERS = [
  "/art/seed/hero-layer-1.webp",
  "/art/seed/hero-layer-2.webp",
  "/art/seed/hero-layer-3.webp",
  "/art/seed/original-2.webp",
  "/art/seed/original-3.webp",
  "/art/seed/signup-gallery.webp",
] as const;

const PORTRAITS = [
  "/art/seed/artist-juno.webp",
  "/art/seed/artist-elias.webp",
  "/art/seed/artist-emmett.webp",
] as const;

/** Sale states for the seeded originals, in the order of the seed: price in pence where for sale. */
const ORIGINAL_STATES: readonly {
  slug: string;
  state: "for_sale" | "price_on_application" | "sold";
  pricePence?: number;
}[] = [
  { slug: "tidal-forms", state: "for_sale", pricePence: 480_000 },
  { slug: "quiet-orchard", state: "for_sale", pricePence: 145_000 },
  { slug: "harbour-light", state: "sold" },
  { slug: "bronze-tide", state: "for_sale", pricePence: 920_000 },
  { slug: "vessel-form-ii", state: "price_on_application" },
  { slug: "still-water", state: "sold" },
];

export function assertDemoSeedTarget(env: {
  databaseUrl: string | undefined;
  nodeEnv?: string | undefined;
  appEnv?: string | undefined;
}): string {
  if (!env.databaseUrl) throw new Error("[demo-full] DATABASE_URL_SHOP is required");
  const production = (value: string | undefined) =>
    ["production", "prod"].includes((value ?? "").toLowerCase());
  if (production(env.nodeEnv) || production(env.appEnv)) {
    throw new Error("[demo-full] refusing to run in production");
  }
  if (/prod/i.test(new URL(env.databaseUrl).hostname)) {
    throw new Error("[demo-full] refusing a production database host");
  }
  return env.databaseUrl;
}

function pick<T>(list: readonly T[], index: number): T {
  return list[index % list.length] as T;
}

export async function seedDemoFull(db: Database): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};

  // Artists without a portrait take the lead picture of one of their own works.
  const fromWorks = await db.execute(sql`
    update shop_artist artist
    set portrait_image_url = lead.media_key
    from (
      select distinct on (work.artist_id) work.artist_id, image.media_key
      from shop_artwork work
      join shop_artwork_image image on image.artwork_id = work.id
      order by work.artist_id, work.created_at, image.position
    ) lead
    where lead.artist_id = artist.id and (artist.portrait_image_url is null or artist.portrait_image_url = '')
  `);
  counts.portraitsFromWorks = fromWorks.rowCount ?? 0;

  // Any artist still without one takes a seed portrait.
  const bare = await db.execute<{ id: string }>(
    sql`select id from shop_artist where portrait_image_url is null or portrait_image_url = '' order by slug`,
  );
  for (const [index, row] of bare.rows.entries()) {
    await db.execute(
      sql`update shop_artist set portrait_image_url = ${pick(PORTRAITS, index)} where id = ${row.id}`,
    );
  }
  counts.portraitsFromSeed = bare.rows.length;

  // Stories, exhibitions and venues without a cover take a seed cover.
  for (const table of [
    "shop_editorial_story",
    "shop_editorial_exhibition",
    "shop_editorial_venue",
  ] as const) {
    const bareRows = await db.execute<{ id: string }>(
      sql`select id from ${sql.identifier(table)} where cover_media_key is null or cover_media_key = '' order by slug`,
    );
    for (const [index, row] of bareRows.rows.entries()) {
      await db.execute(
        sql`update ${sql.identifier(table)} set cover_media_key = ${pick(COVERS, index)} where id = ${row.id}`,
      );
    }
    counts[`covers:${table}`] = bareRows.rows.length;
  }

  // Originals in each sale state.
  for (const original of ORIGINAL_STATES) {
    const result = await db.execute(sql`
      update shop_artwork
      set sale_state = ${original.state}::shop_sale_state,
          print_price_pence = ${original.pricePence ?? null}
      where slug = ${original.slug} and sales_channel = 'art'
    `);
    counts[`original:${original.slug}`] = result.rowCount ?? 0;
  }
  return counts;
}
