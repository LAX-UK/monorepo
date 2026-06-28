/**
 * Idempotently seeds an ended sale with press coverage for /press hub testing.
 *
 * Usage (from repo root):
 *   DATABASE_URL=... pnpm --filter @auction/db db:seed:press-demo
 */
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "../src/schema/index.js";
import {
  DEMO_PRESS_COVERAGE,
  PRESS_DEMO_SALE_ID,
  buildPressDemoSaleRow,
} from "../src/seed/shared/press-demo.js";
import { buildPgConnectionConfig } from "../src/ssl.js";

const { Pool } = pg;

async function main() {
  const url = process.env.DATABASE_URL ?? process.env.DATABASE_URL_API;
  if (!url) {
    console.error("Set DATABASE_URL or DATABASE_URL_API");
    process.exit(1);
  }

  const pool = new Pool(buildPgConnectionConfig(url));
  const db = drizzle(pool, { schema });
  const now = Date.now();
  const day = 86_400_000;
  const row = buildPressDemoSaleRow(now, day);

  await db
    .insert(schema.sale)
    .values(row)
    .onConflictDoUpdate({
      target: schema.sale.id,
      set: {
        title: row.title,
        description: row.description,
        status: row.status,
        endTime: row.endTime,
        pressCoverage: DEMO_PRESS_COVERAGE,
        auctionDayImages: row.auctionDayImages,
        updatedAt: new Date(now),
      },
    });

  await pool.end();

  console.log(`Press demo sale ready: ${PRESS_DEMO_SALE_ID}`);
  console.log(`  ${DEMO_PRESS_COVERAGE.length} press items`);
  console.log("  Open /press to preview cards, filters, and day-media rail.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
