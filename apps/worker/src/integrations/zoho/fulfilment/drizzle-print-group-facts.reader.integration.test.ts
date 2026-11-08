import { randomUUID } from "node:crypto";
import { createDb } from "@auction/db";
import { applyApplicationRoleGrants } from "@auction/db/migrate-roles";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDrizzlePrintGroupFactsReader } from "./drizzle-print-group-facts.reader.js";

const ownerUrl = process.env.MIGRATION_TEST_DATABASE_URL;
const workerUrl = process.env.DATABASE_URL_WORKER;

/**
 * Runs the reader as `worker_app`, the role the fulfilment mirror connects with. The Shop tables it
 * reads are denied to that role as a whole, so this fails if the column grants are missing.
 */
describe.skipIf(!ownerUrl || !workerUrl)("print group facts reader as worker_app", () => {
  const tag = randomUUID().slice(0, 8);
  const partyId = randomUUID();
  const artistId = randomUUID();
  const originalId = randomUUID();
  const printsId = randomUUID();
  let owner: pg.Pool;

  beforeAll(async () => {
    if (!ownerUrl) throw new Error("MIGRATION_TEST_DATABASE_URL is required");
    owner = new pg.Pool({ connectionString: ownerUrl });
    await applyApplicationRoleGrants(ownerUrl);
    await owner.query("insert into shop_party (id, display_name) values ($1, $2)", [
      partyId,
      `Artist ${tag}`,
    ]);
    await owner.query("insert into shop_artist (id, party_id, slug) values ($1, $2, $3)", [
      artistId,
      partyId,
      `print-artist-${tag}`,
    ]);
    await owner.query(
      `insert into shop_artwork (id, slug, title, artist_id, eligible_for_edition_allocation, import_key, zoho_product_id)
       values ($1, $2, 'Harbour at dusk', $3, false, $4, $5)`,
      [originalId, `harbour-${tag}`, artistId, `print-group:${tag}:o`, `zp-${tag}`],
    );
    await owner.query(
      `insert into shop_artwork (id, slug, title, artist_id, eligible_for_edition_allocation, import_key,
         source_original_artwork_id, run_kind, medium, dimensions, year_created)
       values ($1, $2, 'Harbour at dusk (prints)', $3, true, $4, $5, 'limited', 'Screenprint', '50 x 70 cm', 2026)`,
      [printsId, `harbour-prints-${tag}`, artistId, `print-group:${tag}:p`, originalId],
    );
    const editions: [string, number, number | null][] = [
      ["original_buyer_entitlement", 1, null],
      ["original_buyer_entitlement", 2, null],
      ["artist", 3, null],
      ["lax", 4, null],
      ["lax", 5, 1],
    ];
    for (const [allocation, ref, proof] of editions) {
      await owner.query(
        `insert into shop_edition (artwork_id, allocation, edition_number, stock_ref, proof_number)
         values ($1, $2::shop_edition_allocation, $3, $4, $5)`,
        [printsId, allocation, proof === null ? ref : null, ref, proof],
      );
    }
  });

  afterAll(async () => {
    if (!owner) return;
    await owner.query("delete from shop_edition where artwork_id = $1", [printsId]);
    await owner.query("delete from shop_artwork where id in ($1, $2)", [printsId, originalId]);
    await owner.query("delete from shop_artist where id = $1", [artistId]);
    await owner.query("delete from shop_party where id = $1", [partyId]);
    await owner.end();
  });

  it("reads the listing, its original and the run's prints by who owns them, without proofs", async () => {
    // biome-ignore lint/style/noNonNullAssertion: gated by skipIf
    const reader = createDrizzlePrintGroupFactsReader(createDb(workerUrl!));
    expect(await reader.read(printsId)).toEqual({
      printsArtworkId: printsId,
      title: "Harbour at dusk (prints)",
      medium: "Screenprint",
      dimensions: "50 x 70 cm",
      year: 2026,
      original: { artworkId: originalId, zohoProductId: `zp-${tag}` },
      editionType: "Numbered",
      total: 4,
      collector: 2,
      artist: 1,
      lax: 1,
    });
  });

  it("says a listing with no original has none, and a missing listing is null", async () => {
    // biome-ignore lint/style/noNonNullAssertion: gated by skipIf
    const reader = createDrizzlePrintGroupFactsReader(createDb(workerUrl!));
    expect((await reader.read(originalId))?.original).toBeNull();
    expect(await reader.read(randomUUID())).toBeNull();
  });
});
