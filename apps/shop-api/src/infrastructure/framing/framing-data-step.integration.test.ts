import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { importTestArtwork } from "../../test-support/shop-fixtures.js";
import {
  createShopDb,
  hasShopIntegrationDb,
  setupShopIntegrationPools,
} from "../../test-support/shop-integration-setup.js";

const migration = readFileSync(
  fileURLToPath(
    new URL(
      "../../../../../packages/db/drizzle/0338_shop_framing_on_editions.sql",
      import.meta.url,
    ),
  ),
  "utf8",
);
/** The migration's data step, as it runs: the last statement in the file. */
const DATA_STEP = migration.slice(migration.indexOf('INSERT INTO "shop_edition_framing"'));

describe.skipIf(!hasShopIntegrationDb)("The 0338 data step for existing frame text", () => {
  let ownerPool: pg.Pool;
  let shopPool: pg.Pool;

  beforeAll(async () => {
    ({ ownerPool, shopPool } = await setupShopIntegrationPools());
  });

  afterAll(async () => {
    await ownerPool.end();
    await shopPool.end();
  });

  async function edition(label: string, printFrame: string | null) {
    const created = await importTestArtwork(createShopDb(shopPool), label);
    await ownerPool.query("update shop_artwork set print_frame = $2 where id = $1", [
      created.artworkId,
      printFrame,
    ]);
    return created.artworkId;
  }

  async function framingOf(artworkId: string) {
    const result = await ownerPool.query(
      "select mode, framed_by_artist from shop_edition_framing where artwork_id = $1",
      [artworkId],
    );
    return result.rows[0] as { mode: string; framed_by_artist: string } | undefined;
  }

  it("turns a description into 'comes framed by the artist', trimmed", async () => {
    const id = await edition("ds-oak", "  Oak frame made by the artist  ");
    await ownerPool.query(DATA_STEP);
    expect(await framingOf(id)).toEqual({
      mode: "framed_by_artist",
      framed_by_artist: "Oak frame made by the artist",
    });
  });

  it.each([
    ["Unframed"],
    ["UNFRAMED"],
    ["No frame"],
    ["Not framed"],
    ["Frame available"],
    ["Framing on request"],
    ["Optional"],
  ])("skips %s, which says the opposite", async (text) => {
    const id = await edition(`ds-skip-${text.toLowerCase().replaceAll(" ", "-")}`, text);
    await ownerPool.query(DATA_STEP);
    expect(await framingOf(id)).toBeUndefined();
  });

  it("skips empty and blank text", async () => {
    const blank = await edition("ds-blank", "   ");
    const none = await edition("ds-null", null);
    await ownerPool.query(DATA_STEP);
    expect(await framingOf(blank)).toBeUndefined();
    expect(await framingOf(none)).toBeUndefined();
  });

  it("cuts a long description to 500 characters", async () => {
    const id = await edition("ds-long", `Oak ${"x".repeat(700)}`);
    await ownerPool.query(DATA_STEP);
    expect((await framingOf(id))?.framed_by_artist).toHaveLength(500);
  });

  it("skips an edition that already offers framing options", async () => {
    const id = await edition("ds-offers", "Oak frame by the artist");
    const option = await ownerPool.query(
      `insert into shop_framing_option
         (code, name, frame, mount, glazing, hanging, lead_time_min_days, lead_time_max_days, status, sort_order)
       values ($1, 'Data step option', 'natural_oak', 'window_conservation', 'uv_acrylic', 'd_rings_cord', 10, 15, 'draft', 960)
       returning id`,
      [`ds-${crypto.randomUUID()}`],
    );
    await ownerPool.query(
      "insert into shop_framing_edition_offer (option_id, artwork_id) values ($1, $2)",
      [(option.rows[0] as { id: string }).id, id],
    );
    await ownerPool.query(DATA_STEP);
    expect(await framingOf(id)).toBeUndefined();
  });

  it("never replaces what staff have set, and a second run changes nothing", async () => {
    const id = await edition("ds-staff", "Old free-text description");
    await ownerPool.query(
      "insert into shop_edition_framing (artwork_id, mode) values ($1, 'framed_only')",
      [id],
    );
    await ownerPool.query(DATA_STEP);
    expect(await framingOf(id)).toMatchObject({ mode: "framed_only" });

    const again = await edition("ds-twice", "Walnut frame by the artist");
    await ownerPool.query(DATA_STEP);
    const first = await framingOf(again);
    await ownerPool.query(DATA_STEP);
    expect(await framingOf(again)).toEqual(first);
  });
});
