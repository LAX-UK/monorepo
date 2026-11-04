import { type AnyColumn, Column, type SQL, getTableName, sql } from "drizzle-orm";

/**
 * A column written with its table name, for the outer row referenced inside a hand-written
 * subquery that sits in a select list.
 *
 * Drizzle prints a column bare ("id") when it is written directly in a select-list expression of a
 * query over one table (a `where` or `order by` always gets the table name). Inside a subquery
 * over another table a bare name resolves to that inner table first, so
 * `select (... where l.sale_id = ${sale.id})` silently compares the inner row with itself.
 * Qualifying the column ("sale"."id") binds it to the outer row whatever shape the outer query has.
 *
 * Anything that is not a column (an already built SQL fragment, a literal) passes through.
 */
export function qualifiedColumn(column: AnyColumn | SQL): SQL {
  if (!(column instanceof Column)) return column;
  return sql`${sql.identifier(getTableName(column.table))}.${sql.identifier(column.name)}`;
}
