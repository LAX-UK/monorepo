import { randomUUID } from "node:crypto";
import { type Database, closeDb, createDb } from "@auction/db";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { rowsOf } from "../rows-of.js";
import { DrizzleZohoDriftReader } from "./drizzle-zoho-drift.reader.js";
import { DrizzleZohoOutboundQueueReader } from "./drizzle-zoho-outbound-queue.reader.js";
import { DrizzleZohoSyncHealthStore } from "./drizzle-zoho-sync-health.store.js";

const url = process.env.DATABASE_URL;

// The read models count whole tables, so the suite runs against private copies of those tables in
// a schema of its own (first on the search path). Nothing here touches, or is touched by, the rows
// other integration files keep in the shared public tables.
const SCHEMA = `zoho_health_${randomUUID().replaceAll("-", "").slice(0, 12)}`;
const TABLES = [
  "zoho_artwork_sync_outcome",
  "zoho_sync_health",
  "artwork_register",
  "domain_events",
  "domain_event_delivery",
];
let db: Database = null as never;

const T0 = new Date("2026-11-03T02:30:00.000Z");
const T1 = new Date("2026-11-04T02:30:00.000Z");
const code = (n: number, kind: "ORI" | "PRI" = "ORI") =>
  `LAX-${kind}-AA-GAC-26-${String(n).padStart(4, "0")}`;
const REF_KIND: Record<string, string> = {
  lax_art: "shop_artwork",
  bid_sale: "bid_lot",
  private_sale: "private_sale",
};
const PAGE = { limit: 25, offset: 0 };

async function register(input: {
  productId: string;
  stockCode: string;
  offer?: string;
  status?: string | null;
  kind?: "original" | "print";
}) {
  const offer = input.offer ?? "held";
  const refKind = REF_KIND[offer] ?? null;
  await db.execute(sql`
    INSERT INTO artwork_register (zoho_product_id, stock_code, kind, title, artist_name, artist_code,
      offer_state, offer_ref_kind, offer_ref_id, catalogue_status)
    VALUES (${input.productId}, ${input.stockCode}, ${input.kind ?? "original"}, ${`Work ${input.stockCode}`},
      'An Artist', 'AA', ${offer}, ${refKind}, ${refKind ? "ref-1" : null},
      ${input.status === undefined ? "Available" : input.status})
  `);
}

async function outcome(input: {
  runId: string;
  productId: string;
  outcome: string;
  reason?: string | null;
  mode?: string;
  at: Date;
}) {
  await db.execute(sql`
    INSERT INTO zoho_artwork_sync_outcome (run_id, mode, zoho_product_id, stock_code, title, outcome, reason, recorded_at)
    VALUES (${input.runId}, ${input.mode ?? "live"}, ${input.productId}, ${`CODE-${input.productId}`},
      ${`Product ${input.productId}`}, ${input.outcome}, ${input.reason ?? null}, ${input.at})
  `);
}

describe.skipIf(!url)("Zoho sync health read models (Postgres)", { timeout: 30_000 }, () => {
  beforeAll(async () => {
    const admin = createDb(url as string);
    try {
      await admin.execute(sql.raw(`CREATE SCHEMA "${SCHEMA}"`));
      for (const table of TABLES) {
        await admin.execute(
          sql.raw(`CREATE TABLE "${SCHEMA}"."${table}" (LIKE public."${table}" INCLUDING ALL)`),
        );
      }
    } finally {
      await closeDb(admin);
    }
    const target = new URL(url as string);
    target.searchParams.set("options", `-c search_path=${SCHEMA},public`);
    db = createDb(target.toString());
  });

  afterAll(async () => {
    await closeDb(db);
    const admin = createDb(url as string);
    try {
      await admin.execute(sql.raw(`DROP SCHEMA IF EXISTS "${SCHEMA}" CASCADE`));
    } finally {
      await closeDb(admin);
    }
  });

  beforeEach(async () => {
    await db.execute(
      sql.raw(`TRUNCATE ${TABLES.map((table) => `"${SCHEMA}"."${table}"`).join(", ")}`),
    );
  });

  describe("sync health store", () => {
    let store: DrizzleZohoSyncHealthStore;
    beforeAll(() => {
      store = new DrizzleZohoSyncHealthStore(db);
    });

    it("reads nothing before the worker has reported", async () => {
      expect(await store.read()).toBeNull();
    });

    it("keeps the modes and a token that refreshes", async () => {
      await store.reportModes({ artworkSync: "live", listing: "off" }, T0);
      await store.recordTokenRefreshed(new Date(T0.getTime() + 3_600_000), T0);
      const record = await store.read();
      expect(record?.modes).toEqual({ artworkSync: "live", listing: "off" });
      expect(record?.token.refreshedAt).toEqual(T0);
      expect(record?.token.failureStreak).toBe(0);
    });

    it("counts failures in a row and a good refresh ends the streak", async () => {
      expect(await store.recordTokenRefreshFailed("zoho_token_refresh_failed_400", T0)).toEqual({
        failureStreak: 1,
      });
      expect(await store.recordTokenRefreshFailed("zoho_token_refresh_failed_400", T1)).toEqual({
        failureStreak: 2,
      });
      const failed = await store.read();
      expect(failed?.token).toMatchObject({
        failureStreak: 2,
        lastFailureAt: T1,
        lastFailureCode: "zoho_token_refresh_failed_400",
      });
      expect(failed?.modes).toBeNull();
      await store.recordTokenRefreshed(new Date(T1.getTime() + 3_600_000), T1);
      expect((await store.read())?.token.failureStreak).toBe(0);
    });
  });

  describe("outbound queue", () => {
    let reader: DrizzleZohoOutboundQueueReader;
    beforeAll(() => {
      reader = new DrizzleZohoOutboundQueueReader(db);
    });

    async function delivery(consumer: string, status: string, createdAt: Date) {
      const [event] = rowsOf<{ id: number }>(
        await db.execute(sql`
        INSERT INTO domain_events (event_type, aggregate_type, aggregate_id, payload, producer)
        VALUES ('artwork_register.offer_changed', 'artwork_register', gen_random_uuid()::text, '{}'::jsonb, 'test')
        RETURNING id
      `),
      );
      await db.execute(sql`
        INSERT INTO domain_event_delivery (consumer, event_id, status, created_at)
        VALUES (${consumer}, ${event?.id}, ${status}, ${createdAt})
      `);
    }

    it("is empty with nothing queued", async () => {
      expect(await reader.stats()).toEqual({ depth: 0, oldestPendingAt: null, deadLettered: 0 });
    });

    it("counts unfinished and dead-lettered writes to Zoho Products only", async () => {
      await delivery("zoho_artwork_writeback", "pending", T1);
      await delivery("zoho_artwork_listing", "retryable", T0);
      await delivery("zoho_artwork_listing", "processing", T1);
      await delivery("zoho_artwork_listing", "succeeded", new Date("2026-01-01T00:00:00Z"));
      await delivery("zoho_artwork_writeback", "dead_lettered", T0);
      await delivery("crm_person_sync", "pending", new Date("2026-01-01T00:00:00Z"));
      expect(await reader.stats()).toEqual({ depth: 3, oldestPendingAt: T0, deadLettered: 1 });
    });
  });

  describe("drift", () => {
    let reader: DrizzleZohoDriftReader;
    beforeAll(() => {
      reader = new DrizzleZohoDriftReader(db);
    });

    it("lists register artworks whose Product is gone, until it comes back", async () => {
      await register({ productId: "p1", stockCode: code(1) });
      await register({ productId: "p2", stockCode: code(2) });
      await register({ productId: "p3", stockCode: code(3) });
      await outcome({
        runId: "nightly:1",
        productId: "p1",
        outcome: "skipped",
        reason: "not_found_in_zoho",
        at: T0,
      });
      await outcome({
        runId: "nightly:1",
        productId: "p2",
        outcome: "skipped",
        reason: "not_found_in_zoho",
        at: T0,
      });
      await outcome({ runId: "nightly:2", productId: "p2", outcome: "unchanged", at: T1 });
      const page = await reader.registerWithoutProduct(PAGE);
      expect(page.total).toBe(1);
      expect(page.rows.map((row) => row.stockCode)).toEqual([code(1)]);
      expect(page.rows[0]).toMatchObject({ zohoProductId: "p1", foundAt: T0, offerState: "held" });
    });

    it("lists Products with no register entry, but not test artists or deletions", async () => {
      await register({ productId: "registered", stockCode: code(10) });
      await outcome({
        runId: "nightly:1",
        productId: "registered",
        outcome: "skipped",
        reason: "invalid_stock_code",
        at: T0,
      });
      await outcome({
        runId: "nightly:1",
        productId: "u1",
        outcome: "skipped",
        reason: "invalid_stock_code",
        at: T0,
      });
      await outcome({
        runId: "nightly:1",
        productId: "u2",
        outcome: "skipped",
        reason: "demo_artist",
        at: T0,
      });
      await outcome({
        runId: "nightly:1",
        productId: "u3",
        outcome: "skipped",
        reason: "not_found_in_zoho",
        at: T0,
      });
      await outcome({
        runId: "nightly:1",
        productId: "u4",
        outcome: "create",
        mode: "dry_run",
        at: T1,
      });
      await outcome({
        runId: "nightly:1",
        productId: "u5",
        outcome: "skipped",
        reason: "missing_title",
        at: T0,
      });
      await outcome({ runId: "nightly:2", productId: "u5", outcome: "unchanged", at: T1 });
      const page = await reader.productsWithoutRegister(PAGE);
      expect(page.total).toBe(2);
      expect(page.rows.map((row) => [row.zohoProductId, row.reason])).toEqual([
        ["u4", null],
        ["u1", "invalid_stock_code"],
      ]);
    });

    it("lists originals whose Zoho Status is not what their place calls for", async () => {
      await register({ productId: "a", stockCode: code(11), offer: "held", status: "Available" });
      await register({
        productId: "b",
        stockCode: code(12),
        offer: "bid_sale",
        status: "Available",
      });
      await register({ productId: "c", stockCode: code(13), offer: "sold", status: null });
      await register({
        productId: "d",
        stockCode: code(14),
        offer: "lax_art",
        status: "Available",
      });
      await register({
        productId: "e",
        stockCode: code(15, "PRI"),
        kind: "print",
        offer: "sold",
        status: "Available",
      });
      const page = await reader.statusMismatches(PAGE);
      expect(page.total).toBe(2);
      expect(page.rows.map((row) => [row.stockCode, row.zohoStatus, row.expectedStatus])).toEqual([
        [code(12), "Available", "In Auction"],
        [code(13), null, "Sold"],
      ]);
    });

    it("counts every list without reading its rows", async () => {
      await register({ productId: "p1", stockCode: code(1) });
      await outcome({
        runId: "nightly:1",
        productId: "p1",
        outcome: "skipped",
        reason: "not_found_in_zoho",
        at: T0,
      });
      await outcome({
        runId: "nightly:1",
        productId: "u1",
        outcome: "skipped",
        reason: "missing_title",
        at: T0,
      });
      await register({ productId: "m1", stockCode: code(2), offer: "sold", status: "Available" });
      expect(await reader.counts()).toEqual({
        registerWithoutProduct: 1,
        productsWithoutRegister: 1,
        statusMismatches: 1,
      });
    });

    it("pages every list and reports the whole total", async () => {
      for (let i = 0; i < 3; i++) {
        await register({
          productId: `m${i}`,
          stockCode: code(20 + i),
          offer: "sold",
          status: "Available",
        });
      }
      const second = await reader.statusMismatches({ limit: 2, offset: 2 });
      expect(second.total).toBe(3);
      expect(second.rows.map((row) => row.stockCode)).toEqual([code(22)]);
    });
  });
});
