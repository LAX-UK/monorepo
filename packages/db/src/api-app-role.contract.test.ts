import pg from "pg";
import { describe, expect, it } from "vitest";
import {
  API_DENY_TABLES,
  API_PRODUCT_PROFILE_TABLES,
  API_SSF_RECEIVER_TABLES,
} from "./migrate-roles.js";
import { buildPgConnectionConfig } from "./ssl.js";

const API_URL = process.env.DATABASE_URL_API ?? process.env.API_APP_DATABASE_URL;
const { Client } = pg;

async function withApiClient<T>(fn: (client: pg.Client) => Promise<T>): Promise<T> {
  if (!API_URL) throw new Error("DATABASE_URL_API is required");
  const client = new Client(buildPgConnectionConfig(API_URL));
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

describe.skipIf(!API_URL)("api_app role contract", () => {
  it("can provision product profiles but cannot delete them", async () => {
    await withApiClient(async (client) => {
      for (const table of API_PRODUCT_PROFILE_TABLES) {
        for (const privilege of ["SELECT", "INSERT", "UPDATE"]) {
          const result = await client.query<{ allowed: boolean }>(
            "select has_table_privilege(current_user, $1, $2) as allowed",
            [`public.${table}`, privilege],
          );
          expect(result.rows[0]?.allowed, `${table}:${privilege}`).toBe(true);
        }
        const deletion = await client.query<{ allowed: boolean }>(
          "select has_table_privilege(current_user, $1, 'DELETE') as allowed",
          [`public.${table}`],
        );
        expect(deletion.rows[0]?.allowed, `${table}:DELETE`).toBe(false);
      }
    });
  });

  it("has no DML privileges on the API deny-list", async () => {
    await withApiClient(async (client) => {
      for (const table of API_DENY_TABLES) {
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

  it("owns only the Bid SSF replay ledger", async () => {
    await withApiClient(async (client) => {
      for (const table of API_SSF_RECEIVER_TABLES) {
        for (const privilege of ["SELECT", "INSERT", "DELETE"]) {
          const result = await client.query<{ allowed: boolean }>(
            "select has_table_privilege(current_user, $1, $2) as allowed",
            [`public.${table}`, privilege],
          );
          expect(result.rows[0]?.allowed, `${table}:${privilege}`).toBe(true);
        }
        const update = await client.query<{ allowed: boolean }>(
          "select has_table_privilege(current_user, $1, 'UPDATE') as allowed",
          [`public.${table}`],
        );
        expect(update.rows[0]?.allowed, `${table}:UPDATE`).toBe(false);
      }
    });
  });

  it("cannot update Bid-owned legacy user columns", async () => {
    await withApiClient(async (client) => {
      for (const column of [
        "role",
        "staff_role",
        "kyc_status",
        "aml_hold_status",
        "suspended_at",
        "mobile",
        "email_status",
      ]) {
        const result = await client.query<{ allowed: boolean }>(
          "select has_column_privilege(current_user, 'public.user', $1, 'UPDATE') as allowed",
          [column],
        );
        expect(result.rows[0]?.allowed, column).toBe(false);
      }
    });
  });

  it("cannot update Identity-owned user columns", async () => {
    await withApiClient(async (client) => {
      for (const column of [
        "name",
        "email",
        "email_verified",
        "image",
        "phone_number",
        "pending_new_email",
        "deletion_requested_at",
      ]) {
        const result = await client.query<{ allowed: boolean }>(
          "select has_column_privilege(current_user, 'public.user', $1, 'UPDATE') as allowed",
          [column],
        );
        expect(result.rows[0]?.allowed, column).toBe(false);
      }
    });
  });
});
