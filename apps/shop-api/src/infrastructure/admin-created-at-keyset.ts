import { type SQL, and, desc, eq, lt, or, sql } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import type { CatalogueCursor } from "../application/catalogue-cursor.js";

export function msTimestamp(column: AnyPgColumn): SQL {
  return sql`date_trunc('milliseconds', ${column})`;
}

export function keysetBeforeCreatedAtId(
  createdAtColumn: AnyPgColumn,
  idColumn: AnyPgColumn,
  cursor: CatalogueCursor,
): SQL {
  const cursorAt = cursor.createdAt;
  const predicate = or(
    lt(msTimestamp(createdAtColumn), cursorAt),
    and(eq(msTimestamp(createdAtColumn), cursorAt), lt(idColumn, cursor.id)),
  );
  if (!predicate) {
    throw new Error("keyset cursor predicate is empty");
  }
  return predicate;
}

export function orderByMsTimestampIdDesc(timestampColumn: AnyPgColumn, idColumn: AnyPgColumn) {
  return [desc(msTimestamp(timestampColumn)), desc(idColumn)] as const;
}
