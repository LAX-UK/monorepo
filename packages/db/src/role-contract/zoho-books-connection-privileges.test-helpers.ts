import { expect } from "vitest";
import type { RolePrivilegeQueryClient } from "./table-privileges.test-helpers.js";

const TABLE = "public.zoho_books_connection";
const COLUMN_PRIVILEGES = ["SELECT", "INSERT", "UPDATE", "REFERENCES"] as const;
const TABLE_PRIVILEGES = [
  "SELECT",
  "INSERT",
  "UPDATE",
  "DELETE",
  "TRUNCATE",
  "REFERENCES",
  "TRIGGER",
] as const;

export interface ZohoBooksColumnGrants {
  readonly select: readonly string[];
  readonly insert: readonly string[];
  readonly update: readonly string[];
}

/**
 * Asserts the connected role holds exactly these privileges on the sealed Zoho Books token table:
 * no table-level privilege at all, and column privileges only where listed (REFERENCES never).
 * Pass nothing for a role that must have no access.
 */
export async function expectZohoBooksConnectionGrants(
  client: RolePrivilegeQueryClient,
  granted: ZohoBooksColumnGrants = { select: [], insert: [], update: [] },
): Promise<void> {
  const columns = await client.query<{ column_name: string }>(
    `select attname as column_name from pg_attribute
      where attrelid = 'public.zoho_books_connection'::regclass and attnum > 0 and not attisdropped
      order by attnum`,
  );
  expect(columns.rows.length).toBeGreaterThan(0);
  for (const privilege of TABLE_PRIVILEGES) {
    const row = await client.query<{ allowed: boolean }>(
      "select has_table_privilege(current_user, $1, $2) as allowed",
      [TABLE, privilege],
    );
    expect(row.rows[0]?.allowed, `table ${privilege}`).toBe(false);
  }
  const expected: Record<string, readonly string[]> = {
    SELECT: granted.select,
    INSERT: granted.insert,
    UPDATE: granted.update,
    REFERENCES: [],
  };
  for (const { column_name: column } of columns.rows) {
    for (const privilege of COLUMN_PRIVILEGES) {
      const row = await client.query<{ allowed: boolean }>(
        "select has_column_privilege(current_user, $1, $2, $3) as allowed",
        [TABLE, column, privilege],
      );
      expect(row.rows[0]?.allowed, `${column} ${privilege}`).toBe(
        expected[privilege]?.includes(column) ?? false,
      );
    }
  }
}
