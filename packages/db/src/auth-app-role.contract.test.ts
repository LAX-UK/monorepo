import pg from "pg";
import { describe, expect, it } from "vitest";
import { AUTH_DENY_TABLES, AUTH_FULL_TABLES, AUTH_INSERT_SELECT_TABLES } from "./migrate-roles.js";
import { buildPgConnectionConfig } from "./ssl.js";

const AUTH_URL = process.env.DATABASE_URL_AUTH ?? process.env.AUTH_APP_DATABASE_URL;
const { Client } = pg;

async function withAuthClient<T>(fn: (client: pg.Client) => Promise<T>): Promise<T> {
  if (!AUTH_URL) throw new Error("DATABASE_URL_AUTH is required");
  const client = new Client(buildPgConnectionConfig(AUTH_URL));
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

async function readPrivileges(
  client: pg.Client,
  tables: readonly string[],
  privileges: readonly string[],
): Promise<Array<{ table_name: string; privilege: string; allowed: boolean }>> {
  const result = await client.query<{
    table_name: string;
    privilege: string;
    allowed: boolean;
  }>(
    `select table_name, privilege,
            has_table_privilege(current_user, 'public.' || table_name, privilege) as allowed
       from unnest($1::text[]) as table_name
       cross join unnest($2::text[]) as privilege`,
    [[...tables], [...privileges]],
  );
  return result.rows;
}

function expectPrivileges(
  rows: Array<{ table_name: string; privilege: string; allowed: boolean }>,
  expected: boolean,
): void {
  for (const row of rows) {
    expect(row.allowed, `${row.table_name}:${row.privilege}`).toBe(expected);
  }
}

describe.skipIf(!AUTH_URL)("auth_app role contract", () => {
  it("has full DML only for Better Auth-owned tables", async () => {
    await withAuthClient(async (client) => {
      expectPrivileges(
        await readPrivileges(client, AUTH_FULL_TABLES, ["SELECT", "INSERT", "UPDATE", "DELETE"]),
        true,
      );
      expectPrivileges(
        await readPrivileges(client, AUTH_FULL_TABLES, ["TRUNCATE", "REFERENCES", "TRIGGER"]),
        false,
      );
    });
  });

  it("can append but cannot mutate auth side-effect tables", async () => {
    await withAuthClient(async (client) => {
      expectPrivileges(
        await readPrivileges(client, AUTH_INSERT_SELECT_TABLES, ["SELECT", "INSERT"]),
        true,
      );
      expectPrivileges(
        await readPrivileges(client, AUTH_INSERT_SELECT_TABLES, [
          "UPDATE",
          "DELETE",
          "TRUNCATE",
          "REFERENCES",
          "TRIGGER",
        ]),
        false,
      );
    });
  });

  it("cannot access product-owned tables", async () => {
    await withAuthClient(async (client) => {
      expectPrivileges(
        await readPrivileges(client, AUTH_DENY_TABLES, ["SELECT", "INSERT", "UPDATE", "DELETE"]),
        false,
      );
    });
  });
});

describe("auth_app role contract (static cutover gate)", () => {
  it("keeps every product table used by Identity boundaries denied", () => {
    expect(AUTH_DENY_TABLES).toEqual([
      "email_outbox",
      "email_suppression",
      "external_accounts",
      "bid_identity_directory",
      "bid_user_profile",
    ]);
    expect(AUTH_INSERT_SELECT_TABLES).not.toContain("email_outbox");
  });

  it("requires DATABASE_URL_AUTH in required CI jobs", () => {
    expect(
      process.env.CI === "true" && process.env.AUTH_ROLE_CONTRACT_REQUIRED === "true"
        ? Boolean(AUTH_URL)
        : true,
    ).toBe(true);
  });
});
