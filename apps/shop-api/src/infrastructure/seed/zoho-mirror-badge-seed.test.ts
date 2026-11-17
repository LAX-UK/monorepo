import type { Database } from "@auction/db";
import { ZOHO_MIRROR_CONSUMER } from "@auction/types";
import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import {
  ZOHO_MIRROR_FIXTURE_ARTWORKS,
  ZOHO_MIRROR_FIXTURE_ORDERS,
  seedZohoMirrorBadgeFixtures,
} from "./zoho-mirror-badge-seed.js";

const LOCAL_URL = "postgresql://shop_app:p@localhost:5432/auction_ci";
const dialect = new PgDialect();

type Statement = { sql: string; params: unknown[] };

/** A hermetic local database that remembers every write; `seeded` makes it hold a past run's rows. */
function fakeDb(seeded = false) {
  const writes: Statement[] = [];
  let nextEvent = 1;
  const execute = async (query: SQL) => {
    const { sql: text, params } = dialect.sqlToQuery(query);
    if (text.includes("to_regclass")) return { rows: [{ name: "auction_ci", has_table: true }] };
    if (text.includes("from demo_seed_target")) {
      return { rows: [{ environment: "local", database_name: "auction_ci" }] };
    }
    if (text.includes("SELECT 1 FROM domain_events")) return { rows: seeded ? [{}] : [] };
    writes.push({ sql: text, params });
    if (text.includes("INSERT INTO domain_events")) return { rows: [{ id: nextEvent++ }] };
    if (text.includes("RETURNING id")) return { rows: seeded ? [] : [{ id: params[0] }] };
    return { rows: [] };
  };
  const db = { execute, transaction: async (run: (tx: unknown) => unknown) => run({ execute }) };
  return { db: db as unknown as Database, writes };
}

const into = (writes: Statement[], table: string) =>
  writes.filter((write) => write.sql.includes(`INSERT INTO ${table} `));

describe("seed:zoho-mirror-badge, the artwork record's fixtures", () => {
  it("writes one original per state, in the register under its fixed id", async () => {
    const { db, writes } = fakeDb();
    const result = await seedZohoMirrorBadgeFixtures(db, { databaseUrl: LOCAL_URL });
    const artworks = into(writes, "artwork_register");
    expect(artworks.map((write) => write.params[0])).toEqual(
      Object.values(ZOHO_MIRROR_FIXTURE_ARTWORKS),
    );
    for (const write of artworks) expect(write.sql).toContain("'original'");
    expect(result.createdArtworks).toEqual([
      "mirrored",
      "pending",
      "failed",
      "dry_run",
      "not_applicable",
    ]);
  });

  it("gives each artwork with a badge the write-back delivery of its offer_changed event, and the unsent one none", async () => {
    const { db, writes } = fakeDb();
    await seedZohoMirrorBadgeFixtures(db, { databaseUrl: LOCAL_URL });
    const artworkEvents = into(writes, "domain_events").filter(
      (write) => write.params[0] === "artwork_register",
    );
    expect(artworkEvents.map((write) => [write.params[1], write.params[2]])).toEqual([
      [ZOHO_MIRROR_FIXTURE_ARTWORKS.mirrored, "artwork_register.offer_changed"],
      [ZOHO_MIRROR_FIXTURE_ARTWORKS.pending, "artwork_register.offer_changed"],
      [ZOHO_MIRROR_FIXTURE_ARTWORKS.failed, "artwork_register.offer_changed"],
      [ZOHO_MIRROR_FIXTURE_ARTWORKS.dry_run, "artwork_register.offer_changed"],
    ]);
    const deliveries = into(writes, "domain_event_delivery").filter(
      (write) => write.params[0] === ZOHO_MIRROR_CONSUMER.artwork,
    );
    expect(deliveries.map((write) => [write.params[2], write.params[6]])).toEqual([
      ["succeeded", null],
      ["retryable", null],
      ["dead_lettered", "Zoho refused: INVALID_DATA on Status"],
      ["skipped", "dry_run"],
    ]);
  });

  it("still writes the order fixtures to the order mirror's ledger", async () => {
    const { db, writes } = fakeDb();
    const result = await seedZohoMirrorBadgeFixtures(db, { databaseUrl: LOCAL_URL });
    expect(into(writes, "shop_order").map((write) => write.params[0])).toEqual(
      Object.values(ZOHO_MIRROR_FIXTURE_ORDERS),
    );
    expect(
      into(writes, "domain_event_delivery").filter(
        (write) => write.params[0] === ZOHO_MIRROR_CONSUMER.order,
      ),
    ).toHaveLength(4);
    expect(result.created).toHaveLength(5);
  });

  it("changes nothing on a second run", async () => {
    const { db, writes } = fakeDb(true);
    const result = await seedZohoMirrorBadgeFixtures(db, { databaseUrl: LOCAL_URL });
    expect(into(writes, "domain_events")).toHaveLength(0);
    expect(into(writes, "domain_event_delivery")).toHaveLength(0);
    expect(result).toMatchObject({ created: [], createdArtworks: [] });
  });
});
