import type pg from "pg";
import { expect } from "vitest";

/** Narrow query port for live Postgres role contract probes. */
export type RolePrivilegeQueryClient = {
  query<T extends pg.QueryResultRow>(
    queryText: string,
    values?: unknown[],
  ): Promise<pg.QueryResult<T>>;
};

export type TablePrivilegeRow = {
  table_name: string;
  privilege: string;
  allowed: boolean;
};

export async function readTablePrivileges(
  client: RolePrivilegeQueryClient,
  tables: readonly string[],
  privileges: readonly string[],
): Promise<TablePrivilegeRow[]> {
  const result = await client.query<TablePrivilegeRow>(
    `select table_name, privilege,
            has_table_privilege(current_user, 'public.' || table_name, privilege) as allowed
       from unnest($1::text[]) as table_name
       cross join unnest($2::text[]) as privilege`,
    [[...tables], [...privileges]],
  );
  return result.rows;
}

export function expectUniformTablePrivileges(
  rows: readonly TablePrivilegeRow[],
  expected: boolean,
): void {
  expectTablePrivileges(rows, () => expected);
}

export function expectTablePrivileges(
  rows: readonly TablePrivilegeRow[],
  resolveExpected: (row: TablePrivilegeRow) => boolean,
): void {
  for (const row of rows) {
    expect(row.allowed, `${row.table_name}:${row.privilege}`).toBe(resolveExpected(row));
  }
}
