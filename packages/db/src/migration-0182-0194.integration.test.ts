import { randomUUID } from "node:crypto";
import pg from "pg";
import { describe, expect, it } from "vitest";
import { runMigrationsPerTransactionThrough } from "./migrate-runner.js";
import { buildPgConnectionConfig } from "./ssl.js";

const migrationUrl = process.env.MIGRATION_TEST_DATABASE_URL;
const THROUGH_0181 = 1791014400000;
const THROUGH_0192 = 1791964800000;
const THROUGH_0194 = 1792137600000;

function isExpectedTeardownPoolError(error: unknown): boolean {
  return (error as Error & { code?: string }).code === "57P01";
}

async function withScratchDatabase(run: (pool: pg.Pool) => Promise<void>): Promise<void> {
  if (!migrationUrl) throw new Error("MIGRATION_TEST_DATABASE_URL is required");
  const databaseName = `auction_shop_legacy_${randomUUID().replaceAll("-", "")}`;
  const adminUrl = new URL(migrationUrl);
  adminUrl.pathname = "/postgres";
  const databaseUrl = new URL(migrationUrl);
  databaseUrl.pathname = `/${databaseName}`;
  const admin = new pg.Client(buildPgConnectionConfig(adminUrl.toString()));
  const errors: unknown[] = [];
  let databaseCreated = false;
  await admin.connect();
  try {
    await admin.query(`CREATE DATABASE "${databaseName}"`);
    databaseCreated = true;
    const pool = new pg.Pool(buildPgConnectionConfig(databaseUrl.toString()));
    const unexpectedPoolErrors: Error[] = [];
    let teardownStarted = false;
    pool.on("error", (error) => {
      if (!teardownStarted || !isExpectedTeardownPoolError(error)) {
        unexpectedPoolErrors.push(error);
      }
    });
    try {
      await run(pool);
    } catch (error) {
      errors.push(error);
    } finally {
      teardownStarted = true;
      try {
        await pool.end();
      } catch (error) {
        if (!isExpectedTeardownPoolError(error)) errors.push(error);
      }
      try {
        await admin.query(
          "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()",
          [databaseName],
        );
      } catch (error) {
        if (!isExpectedTeardownPoolError(error)) errors.push(error);
      }
      errors.push(...unexpectedPoolErrors);
    }
  } catch (error) {
    errors.push(error);
  } finally {
    if (databaseCreated) {
      try {
        await admin.query(`DROP DATABASE IF EXISTS "${databaseName}"`);
      } catch (error) {
        if (!isExpectedTeardownPoolError(error)) errors.push(error);
      }
    }
    try {
      await admin.end();
    } catch (error) {
      if (!isExpectedTeardownPoolError(error)) errors.push(error);
    }
  }
  if (errors.length === 1) throw errors[0];
  if (errors.length > 1)
    throw new AggregateError(errors, "Temporary legacy migration database failed");
}

describe.skipIf(!migrationUrl)("migrations 0182–0194 legacy fixtures", () => {
  it("applies reaudit and phase-1 constraints on legacy-shaped rows", async () => {
    await withScratchDatabase(async (pool) => {
      await runMigrationsPerTransactionThrough(pool, THROUGH_0192);

      const client = await pool.connect();
      let artworkId: string | undefined;
      let laxPartyId: string | undefined;
      let orderLineId: string | undefined;
      let paidOrderId: string | undefined;
      try {
        const laxParty = await client.query<{ id: string }>(
          `SELECT id FROM shop_party WHERE kind = 'lax' ORDER BY id LIMIT 1`,
        );
        laxPartyId = laxParty.rows[0]?.id;
        if (!laxPartyId) {
          const inserted = await client.query<{ id: string }>(
            `INSERT INTO shop_party (display_name, kind) VALUES ('LAX Legacy Test', 'lax') RETURNING id`,
          );
          laxPartyId = inserted.rows[0]?.id;
        }
        const artistParty = await client.query<{ id: string }>(
          `INSERT INTO shop_party (display_name, kind) VALUES ($1, 'artist') RETURNING id`,
          [`artist-party-${randomUUID().slice(0, 8)}`],
        );
        const artist = await client.query<{ id: string }>(
          "INSERT INTO shop_artist (slug, party_id) VALUES ($1, $2) RETURNING id",
          [`legacy-artist-${randomUUID().slice(0, 8)}`, artistParty.rows[0]?.id],
        );
        const artwork = await client.query<{ id: string }>(
          `INSERT INTO shop_artwork (slug, title, artist_id, eligible_for_edition_allocation, import_key)
           VALUES ($1, 'Legacy Art', $2, true, $3) RETURNING id`,
          [`legacy-art-${randomUUID().slice(0, 8)}`, artist.rows[0]?.id, `import:${randomUUID()}`],
        );
        artworkId = artwork.rows[0]?.id;

        await client.query(
          `INSERT INTO shop_edition (artwork_id, edition_number, allocation, owner_party_id, listing_status, custody_status)
           VALUES ($1, 1, 'lax', NULL, 'authorised', 'unprinted')`,
          [artworkId],
        );

        const paidOrder = await client.query<{ id: string }>(
          `INSERT INTO shop_order (identity_subject_id, fulfilment, merchandise_subtotal_pence, fulfilment_surcharge_pence, total_pence, idempotency_key, status)
           VALUES ('legacy-subject', 'collect_brunswick', 5000, 0, 5000, $1, 'paid') RETURNING id`,
          [`idem-${randomUUID()}`],
        );
        paidOrderId = paidOrder.rows[0]?.id;
        const orderLine = await client.query<{ id: string }>(
          `INSERT INTO shop_order_line (order_id, edition_id, artwork_id, seller_party_id, edition_number, unit_price_pence)
           SELECT $1, e.id, e.artwork_id, $2, e.edition_number, 5000
           FROM shop_edition e WHERE e.artwork_id = $3 AND e.allocation = 'lax' LIMIT 1
           RETURNING id`,
          [paidOrderId, laxPartyId, artworkId],
        );
        orderLineId = orderLine.rows[0]?.id;
        await client.query(
          `INSERT INTO shop_payout_ledger (order_line_id, owner_party_id, gross_pence, deductions_pence, net_pence, payout_due_at, status)
           VALUES ($1, $2, 5000, 0, 5000, NOW() + interval '30 days', 'pending_refund_period')`,
          [orderLineId, laxPartyId],
        );

        const broker = await client.query<{ id: string }>(
          `INSERT INTO shop_party (display_name, kind) VALUES ($1, 'broker') RETURNING id`,
          [`broker-${randomUUID().slice(0, 8)}`],
        );
        const clientParty = await client.query<{ id: string }>(
          `INSERT INTO shop_party (display_name, kind) VALUES ($1, 'person') RETURNING id`,
          [`client-${randomUUID().slice(0, 8)}`],
        );
        const brokerId = broker.rows[0]?.id;
        const clientPartyId = clientParty.rows[0]?.id;
        await client.query(
          `INSERT INTO shop_stock_hold (edition_id, broker_party_id, client_party_id, status, expires_at, created_by_subject_id)
           SELECT id, $2, $3, 'active', NOW() + interval '1 day', 'legacy-migration-test'
           FROM shop_edition WHERE artwork_id = $1 LIMIT 1`,
          [artworkId, brokerId, clientPartyId],
        );
        await client.query(
          `INSERT INTO shop_stock_hold (edition_id, broker_party_id, client_party_id, status, expires_at, created_by_subject_id)
           SELECT id, $2, $3, 'active', NOW() + interval '2 days', 'legacy-migration-test'
           FROM shop_edition WHERE artwork_id = $1 LIMIT 1`,
          [artworkId, brokerId, clientPartyId],
        );
      } finally {
        client.release();
      }

      await runMigrationsPerTransactionThrough(pool, THROUGH_0194);

      const verify = await pool.query<{ cnt: string }>(
        `SELECT count(*)::text AS cnt FROM shop_edition WHERE artwork_id = $1 AND allocation = 'lax' AND owner_party_id IS NOT NULL`,
        [artworkId],
      );
      expect(Number(verify.rows[0]?.cnt ?? 0)).toBe(1);

      const payout = await pool.query<{ status: string; blocked_reason: string | null }>(
        "SELECT status, blocked_reason FROM shop_payout_ledger WHERE order_line_id = $1",
        [orderLineId],
      );
      expect(payout.rows[0]?.status).toBe("cancelled");
      expect(payout.rows[0]?.blocked_reason).toBe("lax_platform_seller");

      const fulfilment = await pool.query(
        "SELECT 1 FROM shop_fulfilment WHERE order_id = $1 LIMIT 1",
        [paidOrderId],
      );
      expect(fulfilment.rowCount).toBe(1);

      const activeHolds = await pool.query(
        `SELECT edition_id, count(*)::int AS cnt FROM shop_stock_hold WHERE status = 'active' GROUP BY edition_id HAVING count(*) > 1`,
      );
      expect(activeHolds.rowCount).toBe(0);

      const constraints = await pool.query<{ conname: string }>(
        `SELECT conname FROM pg_constraint WHERE conname IN (
          'shop_basket_line_quantity_positive',
          'shop_basket_line_price_nonnegative',
          'shop_order_line_price_nonnegative'
        )`,
      );
      expect(constraints.rowCount).toBe(3);
    });
  }, 120_000);

  it("maps legacy status at 0182 and keeps status in sync after 0191 trigger", async () => {
    await withScratchDatabase(async (pool) => {
      await runMigrationsPerTransactionThrough(pool, THROUGH_0181);

      const client = await pool.connect();
      let artworkId: string | undefined;
      try {
        const laxParty = await client.query<{ id: string }>(
          `INSERT INTO shop_party (display_name) VALUES ('LAX London Art Exchange') RETURNING id`,
        );
        const laxPartyId = laxParty.rows[0]?.id;
        const artist = await client.query<{ id: string }>(
          "INSERT INTO shop_artist (slug, party_id) VALUES ($1, $2) RETURNING id",
          [`legacy-map-artist-${randomUUID().slice(0, 8)}`, laxPartyId],
        );
        const artwork = await client.query<{ id: string }>(
          `INSERT INTO shop_artwork (slug, title, artist_id, eligible_for_edition_allocation, import_key)
           VALUES ($1, 'Legacy map', $2, true, $3) RETURNING id`,
          [`legacy-map-${randomUUID().slice(0, 8)}`, artist.rows[0]?.id, `import:${randomUUID()}`],
        );
        artworkId = artwork.rows[0]?.id;
        await client.query(
          `INSERT INTO shop_edition (artwork_id, edition_number, allocation, owner_party_id, status)
           VALUES ($1, 1, 'lax', NULL, 'available')`,
          [artworkId],
        );
        await client.query(
          `INSERT INTO shop_edition (artwork_id, edition_number, allocation, owner_party_id, status)
           VALUES ($1, 2, 'lax', NULL, 'sold')`,
          [artworkId],
        );
      } finally {
        client.release();
      }

      await runMigrationsPerTransactionThrough(pool, THROUGH_0194);

      const mapped = await pool.query<{ listing_status: string; status: string }>(
        "SELECT listing_status, status FROM shop_edition WHERE artwork_id = $1 AND edition_number = 1",
        [artworkId],
      );
      expect(mapped.rows[0]?.listing_status).toBe("authorised");
      expect(mapped.rows[0]?.status).toBe("available");

      const soldRow = await pool.query<{ owner_party_id: string | null }>(
        "SELECT owner_party_id FROM shop_edition WHERE artwork_id = $1 AND edition_number = 2",
        [artworkId],
      );
      expect(soldRow.rows[0]?.owner_party_id).toBeNull();

      await pool.query(
        `UPDATE shop_edition SET listing_status = 'reserved' WHERE artwork_id = $1 AND edition_number = 1`,
        [artworkId],
      );
      const synced = await pool.query<{ status: string }>(
        "SELECT status FROM shop_edition WHERE artwork_id = $1 AND edition_number = 1",
        [artworkId],
      );
      expect(synced.rows[0]?.status).toBe("reserved");
    });
  }, 120_000);

  it("0193 reconciles partial grants to effective authorised count", async () => {
    await withScratchDatabase(async (pool) => {
      await runMigrationsPerTransactionThrough(pool, THROUGH_0192);

      const client = await pool.connect();
      let artworkId: string | undefined;
      let ownerPartyId: string | undefined;
      try {
        const ownerParty = await client.query<{ id: string }>(
          `INSERT INTO shop_party (display_name, kind) VALUES ($1, 'artist') RETURNING id`,
          [`partial-grant-owner-${randomUUID().slice(0, 8)}`],
        );
        ownerPartyId = ownerParty.rows[0]?.id;
        const artist = await client.query<{ id: string }>(
          "INSERT INTO shop_artist (slug, party_id) VALUES ($1, $2) RETURNING id",
          [`partial-grant-artist-${randomUUID().slice(0, 8)}`, ownerPartyId],
        );
        const artwork = await client.query<{ id: string }>(
          `INSERT INTO shop_artwork (slug, title, artist_id, eligible_for_edition_allocation, import_key)
           VALUES ($1, 'Partial grant', $2, true, $3) RETURNING id`,
          [
            `partial-grant-${randomUUID().slice(0, 8)}`,
            artist.rows[0]?.id,
            `import:${randomUUID()}`,
          ],
        );
        artworkId = artwork.rows[0]?.id;
        await client.query(
          `INSERT INTO shop_sale_authority_grant (artwork_id, owner_party_id, authorised_count, recorded_by_subject_id, evidence_note)
           VALUES ($1, $2, 1, 'fixture', 'partial grant before 0193')`,
          [artworkId, ownerPartyId],
        );
        for (const editionNumber of [1, 2, 3]) {
          await client.query(
            `INSERT INTO shop_edition (artwork_id, edition_number, allocation, owner_party_id, listing_status, custody_status)
             VALUES ($1, $2, 'artist', $3, 'authorised', 'unprinted')`,
            [artworkId, editionNumber, ownerPartyId],
          );
        }
      } finally {
        client.release();
      }

      await runMigrationsPerTransactionThrough(pool, THROUGH_0194);

      const authorised = await pool.query<{ cnt: string }>(
        `SELECT count(*)::text AS cnt FROM shop_edition WHERE artwork_id = $1 AND listing_status = 'authorised'`,
        [artworkId],
      );
      expect(Number(authorised.rows[0]?.cnt ?? 0)).toBe(1);
    });
  }, 120_000);
});
