import { type SQL, and, asc, desc, eq, gt, lt, or, sql } from "drizzle-orm";
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

export type KeysetDirection = "asc" | "desc";

/**
 * The rows after `cursor` in a list ordered by `timestampColumn` (to the millisecond) and then
 * `idColumn`, both in `direction`: the id breaks ties, so paging never skips or repeats a row.
 */
export function keysetAfter(
  timestampColumn: AnyPgColumn,
  idColumn: AnyPgColumn,
  cursor: CatalogueCursor,
  direction: KeysetDirection,
): SQL {
  if (direction === "desc") return keysetBeforeCreatedAtId(timestampColumn, idColumn, cursor);
  const predicate = or(
    gt(msTimestamp(timestampColumn), cursor.createdAt),
    and(eq(msTimestamp(timestampColumn), cursor.createdAt), gt(idColumn, cursor.id)),
  );
  if (!predicate) {
    throw new Error("keyset cursor predicate is empty");
  }
  return predicate;
}

/** The ORDER BY that `keysetAfter` pages through. */
export function orderByMsTimestampId(
  timestampColumn: AnyPgColumn,
  idColumn: AnyPgColumn,
  direction: KeysetDirection,
) {
  return direction === "desc"
    ? orderByMsTimestampIdDesc(timestampColumn, idColumn)
    : ([asc(msTimestamp(timestampColumn)), asc(idColumn)] as const);
}

/**
 * Full-precision (microsecond) keyset paging on the raw timestamp column.
 *
 * The millisecond helpers above order by `date_trunc('milliseconds', col)`, an expression a plain
 * btree on (col, id) cannot serve. These order and compare on the column itself, so the list can
 * walk the index. A JS `Date` only holds milliseconds, so the position is carried as the text
 * `createdAtMicros(col)` selects alongside each row.
 */
export function createdAtMicros(column: AnyPgColumn): SQL<string> {
  return sql<string>`to_char(${column} AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`;
}

/** The rows after `cursor` in `(column, id)` order, as one row comparison the btree can range-scan. */
export function keysetAfterRaw(
  timestampColumn: AnyPgColumn,
  idColumn: AnyPgColumn,
  cursor: CatalogueCursor,
  direction: KeysetDirection,
): SQL {
  const op = direction === "desc" ? sql`<` : sql`>`;
  const at = cursor.createdAtMicros ?? cursor.createdAt.toISOString();
  return sql`(${timestampColumn}, ${idColumn}) ${op} (${at}::timestamptz, ${cursor.id}::uuid)`;
}

/** The ORDER BY that `keysetAfterRaw` pages through. */
export function orderByRawTimestampId(
  timestampColumn: AnyPgColumn,
  idColumn: AnyPgColumn,
  direction: KeysetDirection,
) {
  return direction === "desc"
    ? ([desc(timestampColumn), desc(idColumn)] as const)
    : ([asc(timestampColumn), asc(idColumn)] as const);
}
