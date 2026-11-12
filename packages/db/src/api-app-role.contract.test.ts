import pg from "pg";
import { describe, expect, it } from "vitest";
import { readUserReadCutoverFromEnv } from "./applied-user-read-cutover.js";
import {
  API_ACCOUNTING_READ_TABLES,
  API_ACCOUNTING_SETTING_TABLES,
  API_DENY_TABLES,
  API_PRODUCT_PROFILE_TABLES,
  API_READ_TABLES,
  API_SSF_RECEIVER_TABLES,
} from "./migrate-roles.js";
import {
  expectTablePrivileges,
  readTablePrivileges,
} from "./role-contract/table-privileges.test-helpers.js";
import { expectZohoBooksConnectionGrants } from "./role-contract/zoho-books-connection-privileges.test-helpers.js";
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

describe.skipIf(!API_URL)("api_app role contract", { timeout: 60_000 }, () => {
  it("has no privilege at all on the sealed Zoho Books tokens", async () => {
    await withApiClient(async (client) => {
      await expectZohoBooksConnectionGrants(client);
    });
  });

  it("can lock a lot row and raise its invoice and payment in the same transaction", async () => {
    // The invoice raise locks the lot first (FOR UPDATE, which needs UPDATE on the table) and
    // re-checks its winner before inserting, so a buyer default cannot slip in between.
    await withApiClient(async (client) => {
      await client.query("BEGIN");
      try {
        await client.query(
          "SELECT status, winner_id, buyer_legal_entity_id FROM lot LIMIT 1 FOR UPDATE",
        );
      } finally {
        await client.query("ROLLBACK");
      }
      const rows = await readTablePrivileges(
        client,
        ["bid_invoice", "bid_invoice_line", "payment"],
        ["INSERT"],
      );
      expectTablePrivileges(rows, () => true);
    });
  });

  it("can read but not write the Bid identity directory", async () => {
    await withApiClient(async (client) => {
      const read = await client.query<{ allowed: boolean }>(
        "select has_table_privilege(current_user, 'public.bid_identity_directory', 'SELECT') as allowed",
      );
      expect(read.rows[0]?.allowed).toBe(true);
      for (const privilege of ["INSERT", "UPDATE", "DELETE"]) {
        const result = await client.query<{ allowed: boolean }>(
          "select has_table_privilege(current_user, 'public.bid_identity_directory', $1) as allowed",
          [privilege],
        );
        expect(result.rows[0]?.allowed, privilege).toBe(false);
      }
    });
  });

  it("only reads accounting documents, their history and the source switch", async () => {
    await withApiClient(async (client) => {
      const privileges = ["SELECT", "INSERT", "UPDATE", "DELETE"];
      const documents = await readTablePrivileges(client, API_ACCOUNTING_READ_TABLES, privileges);
      expectTablePrivileges(documents, (row) => row.privilege === "SELECT");
      const settings = await readTablePrivileges(client, API_ACCOUNTING_SETTING_TABLES, privileges);
      expectTablePrivileges(settings, (row) => row.privilege === "SELECT");
      const column = await client.query<{ allowed: boolean }>(
        `select has_column_privilege(current_user, 'public.accounting_source_setting', 'books_mode', 'UPDATE') as allowed`,
      );
      expect(column.rows[0]).toEqual({ allowed: false });
    });
  });

  it("reads and writes the sealed Xero token columns, and may null the plaintext ones", async () => {
    await withApiClient(async (client) => {
      for (const column of [
        "access_token_sealed",
        "refresh_token_sealed",
        "access_token",
        "refresh_token",
      ]) {
        for (const privilege of ["SELECT", "INSERT", "UPDATE"]) {
          const result = await client.query<{ allowed: boolean }>(
            "select has_column_privilege(current_user, 'public.xero_connection', $1, $2) as allowed",
            [column, privilege],
          );
          expect(result.rows[0]?.allowed, `${column} ${privilege}`).toBe(true);
        }
      }
    });
  });

  it("may run the buyer refund top-up function", async () => {
    await withApiClient(async (client) => {
      const result = await client.query<{ run: boolean }>(
        `select has_function_privilege(current_user, 'public.payment_refund_backfill_from_payout_lines(uuid)', 'EXECUTE') as run`,
      );
      expect(result.rows[0]).toEqual({ run: true });
    });
  });

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

  it("has CRUD privileges on Bid-owned user category interests", async () => {
    await withApiClient(async (client) => {
      const privileges = await client.query<{
        canSelect: boolean;
        canInsert: boolean;
        canUpdate: boolean;
        canDelete: boolean;
      }>(
        `select
           has_table_privilege(current_user, 'public.user_category_interest', 'SELECT') as "canSelect",
           has_table_privilege(current_user, 'public.user_category_interest', 'INSERT') as "canInsert",
           has_table_privilege(current_user, 'public.user_category_interest', 'UPDATE') as "canUpdate",
           has_table_privilege(current_user, 'public.user_category_interest', 'DELETE') as "canDelete"`,
      );

      expect(privileges.rows[0]).toEqual({
        canSelect: true,
        canInsert: true,
        canUpdate: true,
        canDelete: true,
      });
    });
  });

  it("has no DML privileges on the API deny-list", async () => {
    const cutover = await readUserReadCutoverFromEnv();
    await withApiClient(async (client) => {
      const rows = await readTablePrivileges(client, API_DENY_TABLES, [
        "SELECT",
        "INSERT",
        "UPDATE",
        "DELETE",
      ]);
      expectTablePrivileges(rows, (row) =>
        row.table_name === "user" && row.privilege === "SELECT"
          ? !cutover.apiUserSelectRevoked
          : false,
      );
    });
  });

  it("follows the applied 0161 user-read cutover", async () => {
    const cutover = await readUserReadCutoverFromEnv();
    await withApiClient(async (client) => {
      const rows = await readTablePrivileges(
        client,
        ["user"],
        ["SELECT", "INSERT", "UPDATE", "DELETE"],
      );
      expectTablePrivileges(rows, (row) =>
        row.privilege === "SELECT" ? !cutover.apiUserSelectRevoked : false,
      );
    });
  });

  it("appends buyer refunds and reads them, never changing or removing one", async () => {
    await withApiClient(async (client) => {
      const rows = await readTablePrivileges(
        client,
        ["payment_refund"],
        ["SELECT", "INSERT", "UPDATE", "DELETE"],
      );
      expectTablePrivileges(rows, (row) => ["SELECT", "INSERT"].includes(row.privilege));
    });
  });

  it("creates, reads, changes and removes re-offers and seller answers", async () => {
    await withApiClient(async (client) => {
      const rows = await readTablePrivileges(
        client,
        ["lot_reoffer", "seller_consent"],
        ["SELECT", "INSERT", "UPDATE", "DELETE"],
      );
      expectTablePrivileges(rows, () => true);
    });
  });

  it("appends the bank-transfer references and reads them, never changing or removing one", async () => {
    await withApiClient(async (client) => {
      const rows = await readTablePrivileges(
        client,
        ["payment_transfer_reference"],
        ["SELECT", "INSERT", "UPDATE", "DELETE"],
      );
      expectTablePrivileges(rows, (row) => ["SELECT", "INSERT"].includes(row.privilege));
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

  it("does not expose retired Bid-owned columns on user", async () => {
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
        const result = await client.query<{ count: number }>(
          `select count(*)::int as count
           from information_schema.columns
           where table_schema = 'public'
             and table_name = 'user'
             and column_name = $1`,
          [column],
        );
        expect(result.rows[0]?.count, column).toBe(0);
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

describe("api_app role contract (static identity directory gate)", () => {
  it("keeps the directory read-only and denies direct user access by default", () => {
    expect(API_READ_TABLES).toContain("bid_identity_directory");
    expect(API_READ_TABLES).not.toContain("user");
    expect(API_DENY_TABLES).toContain("user");
    expect(API_PRODUCT_PROFILE_TABLES).not.toContain("bid_identity_directory");
  });
});
