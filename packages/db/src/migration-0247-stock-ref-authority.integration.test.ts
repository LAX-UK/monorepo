import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { buildPgConnectionConfig } from "./ssl.js";

const migrationUrl = process.env.MIGRATION_TEST_DATABASE_URL;
const drizzleDir = join(dirname(fileURLToPath(import.meta.url)), "../drizzle");
const read = (name: string) =>
  readFileSync(join(drizzleDir, name), "utf8").replaceAll("--> statement-breakpoint", "");

/** Runs inside one transaction that is always rolled back; each probe sits in a savepoint. */
describe.skipIf(!migrationUrl)("migration 0247 stock references and authority cap", () => {
  let client: pg.Client;
  let artworkId: string;
  let partyId: string;

  async function accepts(sql: string, params: unknown[] = []): Promise<boolean> {
    await client.query("savepoint probe");
    try {
      await client.query(sql, params);
      return true;
    } catch {
      return false;
    } finally {
      await client.query("rollback to savepoint probe");
    }
  }

  beforeAll(async () => {
    client = new pg.Client(buildPgConnectionConfig(migrationUrl as string));
    await client.connect();
  });

  afterAll(async () => {
    await client.end();
  });

  beforeEach(async () => {
    await client.query("rollback");
    await client.query("begin");
    const party = await client.query(
      "insert into shop_party (display_name, kind) values ('Probe artist', 'artist') returning id",
    );
    partyId = party.rows[0].id as string;
    const artist = await client.query(
      "insert into shop_artist (party_id, slug) values ($1, $2) returning id",
      [partyId, `probe-artist-${Date.now()}`],
    );
    const artwork = await client.query(
      `insert into shop_artwork (slug, title, artist_id, eligible_for_edition_allocation, import_key)
       values ($1, 'Probe', $2, true, $3) returning id`,
      [`probe-${Date.now()}`, artist.rows[0].id, `probe:${Date.now()}`],
    );
    artworkId = artwork.rows[0].id as string;
  });

  it("refuses a print inserted without a stock reference", async () => {
    expect(
      await accepts(
        "insert into shop_edition (artwork_id, allocation, edition_number) values ($1, 'artist', 1)",
        [artworkId],
      ),
    ).toBe(false);
    expect(
      await accepts(
        "insert into shop_edition (artwork_id, allocation, edition_number, stock_ref) values ($1, 'artist', 1, 1)",
        [artworkId],
      ),
    ).toBe(true);
  });

  it("accepts sale authority above 10 and still refuses a negative count", async () => {
    const request = (count: number) =>
      accepts(
        "insert into shop_sale_authority_request (artwork_id, owner_party_id, requested_count) values ($1, $2, $3)",
        [artworkId, partyId, count],
      );
    const grant = (count: number) =>
      accepts(
        `insert into shop_sale_authority_grant
           (artwork_id, owner_party_id, authorised_count, recorded_by_subject_id, evidence_note)
         values ($1, $2, $3, 'staff-1', 'probe')`,
        [artworkId, partyId, count],
      );
    expect(await request(30)).toBe(true);
    expect(await request(-1)).toBe(false);
    expect(await grant(30)).toBe(true);
    expect(await grant(-1)).toBe(false);
  });

  it("rolls back to the trigger and the cap of 10, and applies again", async () => {
    // The rollback refuses counts above 10, as its header says; other suites may have left some.
    await client.query("delete from shop_sale_authority_grant where authorised_count > 10");
    await client.query("delete from shop_sale_authority_request where requested_count > 10");
    await client.query(read("0247_rollback.sql"));
    const { rows } = await client.query(
      `insert into shop_edition (artwork_id, allocation, edition_number)
       values ($1, 'artist', 7) returning stock_ref`,
      [artworkId],
    );
    expect(rows[0].stock_ref).toBe(7);
    expect(
      await accepts(
        "insert into shop_sale_authority_request (artwork_id, owner_party_id, requested_count) values ($1, $2, 11)",
        [artworkId, partyId],
      ),
    ).toBe(false);
    await client.query("delete from shop_edition where artwork_id = $1", [artworkId]);
    await client.query(read("0247_shop_edition_stock_ref_and_authority_cap.sql"));
    const trigger = await client.query(
      "select 1 from pg_trigger where tgname = 'shop_edition_default_stock_ref_trg'",
    );
    expect(trigger.rows).toHaveLength(0);
  });
});
