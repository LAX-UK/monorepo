import pg from "pg";
import { describe, expect, it } from "vitest";
import {
  AUTH_DENY_TABLES,
  AUTH_EXTERNAL_ACCOUNT_TABLES,
  AUTH_FULL_TABLES,
  AUTH_INSERT_SELECT_TABLES,
  AUTH_PRODUCT_LINK_READ_TABLES,
} from "./migrate-roles.js";
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

describe.skipIf(!AUTH_URL)("auth_app role contract", () => {
  it("has full DML only for Better Auth-owned tables", async () => {
    await withAuthClient(async (client) => {
      for (const table of AUTH_FULL_TABLES) {
        for (const privilege of ["SELECT", "INSERT", "UPDATE", "DELETE"]) {
          const result = await client.query<{ allowed: boolean }>(
            "select has_table_privilege(current_user, $1, $2) as allowed",
            [`public.${table}`, privilege],
          );
          expect(result.rows[0]?.allowed, `${table}:${privilege}`).toBe(true);
        }
        for (const privilege of ["TRUNCATE", "REFERENCES", "TRIGGER"]) {
          const result = await client.query<{ allowed: boolean }>(
            "select has_table_privilege(current_user, $1, $2) as allowed",
            [`public.${table}`, privilege],
          );
          expect(result.rows[0]?.allowed, `${table}:${privilege}`).toBe(false);
        }
      }
    });
  });

  it("can append but cannot mutate auth side-effect tables", async () => {
    await withAuthClient(async (client) => {
      for (const table of AUTH_INSERT_SELECT_TABLES) {
        for (const privilege of ["SELECT", "INSERT"]) {
          const result = await client.query<{ allowed: boolean }>(
            "select has_table_privilege(current_user, $1, $2) as allowed",
            [`public.${table}`, privilege],
          );
          expect(result.rows[0]?.allowed, `${table}:${privilege}`).toBe(true);
        }
        for (const privilege of ["UPDATE", "DELETE", "TRUNCATE", "REFERENCES", "TRIGGER"]) {
          const result = await client.query<{ allowed: boolean }>(
            "select has_table_privilege(current_user, $1, $2) as allowed",
            [`public.${table}`, privilege],
          );
          expect(result.rows[0]?.allowed, `${table}:${privilege}`).toBe(false);
        }
      }
    });
  });

  it("can only read Bid product links for signup compensation", async () => {
    await withAuthClient(async (client) => {
      for (const table of AUTH_PRODUCT_LINK_READ_TABLES) {
        const read = await client.query<{ allowed: boolean }>(
          "select has_table_privilege(current_user, $1, 'SELECT') as allowed",
          [`public.${table}`],
        );
        expect(read.rows[0]?.allowed, `${table}:SELECT`).toBe(true);
        for (const privilege of ["INSERT", "UPDATE", "DELETE"]) {
          const result = await client.query<{ allowed: boolean }>(
            "select has_table_privilege(current_user, $1, $2) as allowed",
            [`public.${table}`, privilege],
          );
          expect(result.rows[0]?.allowed, `${table}:${privilege}`).toBe(false);
        }
      }
    });
  });

  it("cannot access product-owned email pipeline tables", async () => {
    await withAuthClient(async (client) => {
      for (const table of AUTH_DENY_TABLES) {
        for (const privilege of ["SELECT", "INSERT", "UPDATE", "DELETE"]) {
          const result = await client.query<{ allowed: boolean }>(
            "select has_table_privilege(current_user, $1, $2) as allowed",
            [`public.${table}`, privilege],
          );
          expect(result.rows[0]?.allowed, `${table}:${privilege}`).toBe(false);
        }
      }
    });
  });

  it("can retarget but cannot create or delete external account links", async () => {
    await withAuthClient(async (client) => {
      for (const table of AUTH_EXTERNAL_ACCOUNT_TABLES) {
        for (const privilege of ["SELECT", "UPDATE"]) {
          const result = await client.query<{ allowed: boolean }>(
            "select has_table_privilege(current_user, $1, $2) as allowed",
            [`public.${table}`, privilege],
          );
          expect(result.rows[0]?.allowed, `${table}:${privilege}`).toBe(true);
        }
        for (const privilege of ["INSERT", "DELETE"]) {
          const result = await client.query<{ allowed: boolean }>(
            "select has_table_privilege(current_user, $1, $2) as allowed",
            [`public.${table}`, privilege],
          );
          expect(result.rows[0]?.allowed, `${table}:${privilege}`).toBe(false);
        }
      }
    });
  });
});

describe("auth_app role contract (static cutover gate)", () => {
  it("keeps product email pipeline tables denied", () => {
    expect(AUTH_DENY_TABLES).toEqual(["email_outbox", "email_suppression"]);
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
