/**
 * Remove temp marketing demo fixtures from prod (run when testing is done).
 * Usage: DATABASE_URL='postgresql://.../auction' node scripts/prod-temp-marketing-bid-cleanup.mjs
 */
import pg from "pg";

const TEMP_SALE_ID = "a9000001-0000-4000-8000-000000000001";
const TEMP_LOT_ID = "a9000002-0000-4000-8000-000000000002";
const TEMP_BUYER_LE_ID = "a9000003-0000-4000-8000-000000000003";
const TEMP_BID_ID = "a9000004-0000-4000-8000-000000000004";
const USER_EMAIL = "danalytics.ah@gmail.com";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });

async function main() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `DELETE FROM domain_events
       WHERE aggregate_id IN ($1, $2, $3) OR acting_legal_entity_id = $4`,
      [TEMP_LOT_ID, TEMP_SALE_ID, TEMP_BID_ID, TEMP_BUYER_LE_ID],
    );
    await client.query("DELETE FROM bid WHERE id = $1 OR lot_id = $2", [TEMP_BID_ID, TEMP_LOT_ID]);
    await client.query("DELETE FROM lot WHERE id = $1", [TEMP_LOT_ID]);
    await client.query("DELETE FROM sale WHERE id = $1", [TEMP_SALE_ID]);
    await client.query("DELETE FROM legal_entity_member WHERE legal_entity_id = $1", [
      TEMP_BUYER_LE_ID,
    ]);
    await client.query("DELETE FROM legal_entity WHERE id = $1", [TEMP_BUYER_LE_ID]);
    await client.query("COMMIT");

    const user = await client.query(`SELECT id FROM "user" WHERE email = $1`, [USER_EMAIL]);
    const mem = await client.query(
      "SELECT count(*)::int AS c FROM legal_entity_member WHERE user_id = $1",
      [user.rows[0]?.id],
    );
    console.log("Removed temp sale, lot, bid, and buyer legal entity for", USER_EMAIL);
    console.log("Legal entity memberships remaining:", mem.rows[0]?.c ?? "n/a");
    console.log("(User account retained.)");
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
