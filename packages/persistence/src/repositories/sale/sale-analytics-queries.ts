import type { Database } from "@auction/db";
import { sql } from "drizzle-orm";

/** Average non-deleted lots per non-deleted sale (0 when no sales exist). */
export async function queryAvgLotsPerSale(db: Database): Promise<number> {
  const result = await db.execute(sql`
    SELECT COALESCE(AVG(lot_count), 0)::float AS avg
    FROM (
      SELECT COUNT(l.id)::float AS lot_count
      FROM sale s
      LEFT JOIN lot l ON l.sale_id = s.id AND l.deleted_at IS NULL
      WHERE s.deleted_at IS NULL
      GROUP BY s.id
    ) sub
  `);
  const row = result.rows[0] as { avg: number } | undefined;
  return row?.avg ?? 0;
}
