import { type SQL, sql } from "drizzle-orm";

/**
 * The first non-empty line of a stored error, trimmed, in SQL: what Failed jobs summarises a
 * failure by, so failures that read the same can be counted together in the database.
 */
export function firstErrorLine(column: SQL): SQL<string> {
  return sql<string>`btrim(split_part(btrim(coalesce(${column}, ''), E' \\t\\r\\n'), E'\\n', 1), E' \\t\\r')`;
}
