/**
 * Reset saleroom / bidding activity on a test DB while keeping sales, lots, and users.
 *
 * Usage:
 *   DATABASE_URL='postgresql://.../auction' node scripts/reset-test-saleroom-state.mjs --confirm
 *
 * Optional:
 *   --no-extend-schedule   Do not re-open ended sales or push end_time forward
 *   --dry-run              Print planned actions without writing
 */
import pg from "pg";

const args = new Set(process.argv.slice(2));
const confirm = args.has("--confirm");
const dryRun = args.has("--dry-run");
const extendSchedule = !args.has("--no-extend-schedule");

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

if (!confirm && !dryRun) {
  console.error("Pass --confirm to apply changes, or --dry-run to preview.");
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString: url.replace(/[?&]sslmode=[^&]*/g, ""),
  ssl: { rejectUnauthorized: false },
});

/** CTE: non-deleted sales and their lot ids */
const SALE_SCOPE = `
  scoped_sales AS (
    SELECT id, title, status, start_time, end_time
    FROM sale
    WHERE deleted_at IS NULL
  ),
  scoped_lots AS (
    SELECT l.id, l.sale_id
    FROM lot l
    JOIN scoped_sales s ON s.id = l.sale_id
    WHERE l.deleted_at IS NULL
  )
`;

async function main() {
  const client = await pool.connect();
  try {
    const before = await client.query(`
      WITH ${SALE_SCOPE}
      SELECT
        (SELECT count(*) FROM scoped_sales) AS sales,
        (SELECT count(*) FROM scoped_lots) AS lots,
        (SELECT count(*) FROM saleroom_session ss JOIN scoped_sales s ON s.id = ss.sale_id) AS saleroom_sessions,
        (SELECT count(*) FROM bid b JOIN scoped_lots l ON l.id = b.lot_id) AS bids,
        (SELECT count(*) FROM sale_registration sr JOIN scoped_sales s ON s.id = sr.sale_id) AS registrations,
        (SELECT count(*) FROM telephone_bid_booking tb JOIN scoped_sales s ON s.id = tb.sale_id) AS tel_bookings,
        (SELECT count(*) FROM payment p JOIN scoped_lots l ON l.id = p.lot_id) AS payments,
        (SELECT count(*) FROM scoped_lots l JOIN lot lo ON lo.id = l.id WHERE lo.winner_id IS NOT NULL) AS lots_with_winner
    `);

    console.log("Before:", before.rows[0]);

    if (dryRun) {
      console.log("\nDry run — no changes applied.");
      console.log("Would clear saleroom sessions, bids, registrations, payments, and reset lots.");
      if (extendSchedule) {
        console.log("Would set non-draft sales to active and extend end_time by 48h where needed.");
      }
      return;
    }

    await client.query("BEGIN");

    // Saleroom
    await client.query(`
      WITH ${SALE_SCOPE}
      DELETE FROM saleroom_event e
      USING saleroom_session ss, scoped_sales s
      WHERE e.session_id = ss.id AND ss.sale_id = s.id
    `);
    await client.query(`
      WITH ${SALE_SCOPE}
      DELETE FROM saleroom_display_pairing dp
      USING scoped_sales s
      WHERE dp.sale_id = s.id
    `);
    await client.query(`
      WITH ${SALE_SCOPE}
      DELETE FROM saleroom_session ss
      USING scoped_sales s
      WHERE ss.sale_id = s.id
    `);

    // Payments / payouts
    await client.query(`
      WITH ${SALE_SCOPE},
      scoped_payments AS (
        SELECT p.id FROM payment p JOIN scoped_lots l ON l.id = p.lot_id
      )
      DELETE FROM payout_line pl
      USING scoped_payments sp
      WHERE pl.payment_id = sp.id
    `);
    await client.query(`
      DELETE FROM payout p
      WHERE NOT EXISTS (SELECT 1 FROM payout_line pl WHERE pl.payout_id = p.id)
    `);
    await client.query(`
      WITH ${SALE_SCOPE},
      scoped_payments AS (
        SELECT p.id FROM payment p JOIN scoped_lots l ON l.id = p.lot_id
      )
      DELETE FROM payment_external_ref per
      USING scoped_payments sp
      WHERE per.payment_id = sp.id
    `);
    await client.query(`
      WITH ${SALE_SCOPE},
      scoped_payments AS (
        SELECT p.id FROM payment p JOIN scoped_lots l ON l.id = p.lot_id
      )
      DELETE FROM payment_refund_reconcile prr
      USING scoped_payments sp
      WHERE prr.payment_id = sp.id
    `);
    await client.query(`
      WITH ${SALE_SCOPE}
      DELETE FROM payment p
      USING scoped_lots l
      WHERE p.lot_id = l.id
    `);

    // Bidding / registration
    await client.query(`
      WITH ${SALE_SCOPE}
      UPDATE absentee_bid ab SET executed_bid_id = NULL
      FROM scoped_lots l
      WHERE ab.lot_id = l.id AND ab.executed_bid_id IS NOT NULL
    `);
    await client.query(`
      WITH ${SALE_SCOPE}
      DELETE FROM bid b
      USING scoped_lots l
      WHERE b.lot_id = l.id
    `);
    await client.query(`
      WITH ${SALE_SCOPE}
      DELETE FROM absentee_bid ab
      USING scoped_lots l
      WHERE ab.lot_id = l.id
    `);
    await client.query(`
      WITH ${SALE_SCOPE}
      DELETE FROM telephone_bid_booking tb
      USING scoped_sales s
      WHERE tb.sale_id = s.id
    `);
    await client.query(`
      WITH ${SALE_SCOPE}
      DELETE FROM sale_registration sr
      USING scoped_sales s
      WHERE sr.sale_id = s.id
    `);
    await client.query(`
      WITH ${SALE_SCOPE}
      DELETE FROM buyer_agent_authorisation baa
      USING scoped_sales s
      WHERE baa.sale_id = s.id
    `);

    // Fulfilment / snapshots / watchlists
    await client.query(`
      WITH ${SALE_SCOPE}
      DELETE FROM lot_fulfilment lf
      USING scoped_lots l
      WHERE lf.lot_id = l.id
    `);
    await client.query(`
      WITH ${SALE_SCOPE}
      DELETE FROM lot_lifecycle_snapshot lls
      USING scoped_lots l
      WHERE lls.lot_id = l.id
    `);
    await client.query(`
      WITH ${SALE_SCOPE}
      DELETE FROM watchlist w
      USING scoped_lots l
      WHERE w.lot_id = l.id
    `);
    await client.query(`
      WITH ${SALE_SCOPE}
      DELETE FROM notification n
      USING scoped_lots l
      WHERE n.lot_id = l.id
    `);

    // Domain events for affected aggregates
    await client.query(`
      WITH ${SALE_SCOPE}
      DELETE FROM domain_events de
      WHERE de.aggregate_id IN (
        SELECT id::text FROM scoped_sales
        UNION
        SELECT id::text FROM scoped_lots
      )
    `);

    if (extendSchedule) {
      await client.query(`
        UPDATE sale s
        SET
          status = CASE WHEN s.status = 'draft' THEN s.status ELSE 'active' END,
          end_time = CASE
            WHEN s.status = 'draft' THEN s.end_time
            WHEN s.end_time <= NOW() THEN NOW() + INTERVAL '48 hours'
            ELSE GREATEST(s.end_time, NOW() + INTERVAL '24 hours')
          END,
          updated_at = NOW()
        WHERE s.deleted_at IS NULL
      `);
    }

    // Reset lot bidding state
    await client.query(`
      WITH ${SALE_SCOPE}
      UPDATE lot l
      SET
        winner_id = NULL,
        buyer_legal_entity_id = NULL,
        voided_reason = NULL,
        current_price = starting_price,
        status = CASE
          WHEN s.status = 'draft' THEN l.status
          WHEN s.status = 'cancelled' THEN l.status
          WHEN l.status IN ('cancelled', 'draft') THEN l.status
          ELSE 'active'
        END,
        end_time = CASE
          WHEN s.status = 'draft' THEN l.end_time
          ELSE s.end_time
        END,
        updated_at = NOW()
      FROM scoped_sales s
      WHERE l.sale_id = s.id
        AND l.deleted_at IS NULL
    `);

    await client.query("COMMIT");

    const after = await client.query(`
      WITH ${SALE_SCOPE}
      SELECT
        (SELECT count(*) FROM saleroom_session ss JOIN scoped_sales s ON s.id = ss.sale_id) AS saleroom_sessions,
        (SELECT count(*) FROM bid b JOIN scoped_lots l ON l.id = b.lot_id) AS bids,
        (SELECT count(*) FROM sale_registration sr JOIN scoped_sales s ON s.id = sr.sale_id) AS registrations,
        (SELECT count(*) FROM payment p JOIN scoped_lots l ON l.id = p.lot_id) AS payments,
        (SELECT count(*) FROM scoped_lots l JOIN lot lo ON lo.id = l.id WHERE lo.winner_id IS NOT NULL) AS lots_with_winner
    `);

    const sales = await client.query(`
      SELECT title, status, start_time, end_time
      FROM sale
      WHERE deleted_at IS NULL
      ORDER BY title
    `);

    console.log("\nAfter:", after.rows[0]);
    console.log("\nSales:");
    console.table(sales.rows);
    console.log("\nDone — sales and lots kept; activity cleared.");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error("FAILED:", e.message ?? e);
  process.exit(1);
});
