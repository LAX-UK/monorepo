import type { Database } from "@auction/db";
import { type SQL, count, gt } from "drizzle-orm";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";

/** Resumes a page after the last key returned; no condition on the first page. */
export function afterKey(column: PgColumn, key: string | null): SQL | undefined {
  return key === null ? undefined : gt(column, key);
}

export async function countWhere(
  db: Database,
  table: PgTable,
  where: SQL | undefined,
): Promise<number> {
  const [row] = await db.select({ n: count() }).from(table).where(where);
  return Number(row?.n ?? 0);
}
