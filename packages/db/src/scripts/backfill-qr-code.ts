/**
 * Idempotent backfill: create default dynamic QR rows for existing sales and lots.
 *
 *   DATABASE_URL=... pnpm --filter @auction/db db:backfill-qr-code
 */
import { and, asc, eq } from "drizzle-orm";
import { createDb } from "../client.js";
import { lot } from "../schema/lots.js";
import { qrCode } from "../schema/qr-code.js";
import { sale } from "../schema/sales.js";

const BASE62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const COUNTER_MASK = 0x5deece66dn;

const db = createDb(process.env.DATABASE_URL ?? "");

function encodeBackfillSequence(sequence: bigint): string {
  let value = sequence ^ COUNTER_MASK;
  let out = "";
  do {
    out = BASE62[Number(value % 62n)] + out;
    value /= 62n;
  } while (value > 0n);
  return `B${out.padStart(8, BASE62[0])}`;
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("Set DATABASE_URL");
    process.exit(1);
  }

  const [sales, lots] = await Promise.all([
    db.select({ id: sale.id }).from(sale).orderBy(asc(sale.id)),
    db.select({ id: lot.id }).from(lot).orderBy(asc(lot.id)),
  ]);

  let sequence = 1n;
  let inserted = 0;
  let skipped = 0;

  for (const row of sales) {
    const shortCode = encodeBackfillSequence(sequence++);
    const [existing] = await db
      .select({ id: qrCode.id })
      .from(qrCode)
      .where(
        and(eq(qrCode.entityType, "sale"), eq(qrCode.entityId, row.id), eq(qrCode.isDefault, true)),
      )
      .limit(1);
    if (existing) {
      skipped++;
      continue;
    }
    await db.insert(qrCode).values({
      shortCode,
      entityType: "sale",
      entityId: row.id,
    });
    inserted++;
  }

  for (const row of lots) {
    const shortCode = encodeBackfillSequence(sequence++);
    const [existing] = await db
      .select({ id: qrCode.id })
      .from(qrCode)
      .where(
        and(eq(qrCode.entityType, "lot"), eq(qrCode.entityId, row.id), eq(qrCode.isDefault, true)),
      )
      .limit(1);
    if (existing) {
      skipped++;
      continue;
    }
    await db.insert(qrCode).values({
      shortCode,
      entityType: "lot",
      entityId: row.id,
    });
    inserted++;
  }

  console.log(`backfill complete: inserted=${inserted} skipped=${skipped}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
