#!/usr/bin/env node
import pg from "pg";

const databaseUrl = process.env.DATABASE_URL_OWNER;
const startedAt = process.env.ACCEPTANCE_STARTED_AT;
const timeoutMs = Number(process.env.BACKCHANNEL_LOGOUT_TIMEOUT_MS ?? 60_000);
const expected = new Map([
  ["lax-bid-web", "https://test.lax.bid/api/auth/backchannel-logout"],
  ["lax-shop-web", "https://test-shop.lax.art/api/auth/backchannel-logout"],
]);

if (!databaseUrl || !startedAt || Number.isNaN(Date.parse(startedAt))) {
  throw new Error("DATABASE_URL_OWNER and a valid ACCEPTANCE_STARTED_AT are required");
}

const client = new pg.Client({
  connectionString: databaseUrl,
  ssl: process.env.DATABASE_SSL === "false" ? undefined : { rejectUnauthorized: false },
});

try {
  await client.connect();
  const deadline = Date.now() + timeoutMs;
  let rows = [];
  do {
    const result = await client.query(
      `SELECT DISTINCT ON (client_id)
         client_id, endpoint, status, attempt_count, last_status_code, last_error
       FROM oidc_backchannel_logout_delivery
       WHERE created_at >= $1
         AND client_id = ANY($2::text[])
       ORDER BY client_id, created_at DESC`,
      [new Date(startedAt), [...expected.keys()]],
    );
    rows = result.rows;
    if (
      rows.length === expected.size &&
      rows.every((row) => row.status === "delivered" && row.last_status_code === 200)
    ) {
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 2_000));
  } while (Date.now() < deadline);

  for (const [clientId, endpoint] of expected) {
    const delivery = rows.find((row) => row.client_id === clientId);
    if (
      delivery?.endpoint !== endpoint ||
      delivery.status !== "delivered" ||
      delivery.last_status_code !== 200
    ) {
      throw new Error(`Back-channel logout failed for ${clientId}: ${JSON.stringify(delivery)}`);
    }
  }
  console.log("Bid and Shop back-channel logout deliveries passed");
} finally {
  await client.end().catch(() => undefined);
}
