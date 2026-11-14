import pg from "pg";
import { describe, expect, it } from "vitest";
import { readUserReadCutoverFromEnv } from "./applied-user-read-cutover.js";
import {
  API_ACCOUNTING_REQUEUE_COLUMNS,
  API_ACCOUNTING_SETTING_TABLES,
  API_DENY_TABLES,
  API_PRODUCT_PROFILE_TABLES,
  API_READ_TABLES,
  API_SSF_RECEIVER_TABLES,
  API_UNLINKED_ORIGINALS_READ_COLUMNS,
  FINANCE_SETTING_READ_TABLES,
  SELLER_TERMS_INSERT_SELECT_TABLES,
  SELLER_TERMS_RECOMPUTE_UPDATE_COLUMNS,
} from "./migrate-roles.js";
import {
  expectTablePrivileges,
  readTablePrivileges,
} from "./role-contract/table-privileges.test-helpers.js";
import { expectZohoBooksConnectionGrants } from "./role-contract/zoho-books-connection-privileges.test-helpers.js";
import { buildPgConnectionConfig } from "./ssl.js";

/** Every column of the seller-terms table, including the ones settlement must never rewrite. */
const SELLER_TERMS_PROBE_COLUMNS = [
  ...SELLER_TERMS_RECOMPUTE_UPDATE_COLUMNS,
  "payment_id",
  "lot_id",
  "seller_legal_entity_id",
  "hammer_pence",
  "premium_pence",
  "legacy_platform_fee_pence",
] as const;

const API_URL = process.env.DATABASE_URL_API ?? process.env.API_APP_DATABASE_URL;
const OWNER_URL = process.env.DATABASE_URL_OWNER;
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

/** Run one statement in a savepoint; returns the SQLSTATE it was refused with, if any. */
async function probe(
  client: pg.Client,
  text: string,
  values: unknown[],
): Promise<string | undefined> {
  await client.query("SAVEPOINT probe");
  try {
    await client.query(text, values);
    await client.query("RELEASE SAVEPOINT probe");
    return undefined;
  } catch (error) {
    await client.query("ROLLBACK TO SAVEPOINT probe");
    return (error as { code?: string }).code;
  }
}

/**
 * As the owner, add a refused document and one the provider issued (the API role cannot insert
 * documents), hand their ids to `fn`, and remove them afterwards. `fn` must leave no history.
 */
async function withOwnerDocuments<T>(
  fn: (ids: { failed: string; issued: string; withheld: string; differs: string }) => Promise<T>,
): Promise<T> {
  const owner = new Client(buildPgConnectionConfig(OWNER_URL ?? ""));
  await owner.connect();
  const suffix = `contract-${process.pid}-${Date.now()}`;
  const insert = async (
    reference: string,
    state: "failed" | "issued" | "needs_review",
    lastErrorClass: string | null,
    providerId: string | null,
    reviewReason: string | null = null,
  ) => {
    const result = await owner.query<{ id: string }>(
      `insert into accounting_document (product, legal_entity, kind, lax_reference,
         source_event_ref, payload, net_pence, vat_pence, gross_pence, provider, target_provider,
         target_mode, attempts, state, last_error_class, provider_id, provider_number,
         review_lookup, needs_review_reason)
       values ('bid', 'london_auction_xchange', 'invoice', $1, 'evt', '{}', 100, 20, 120,
         'books', 'books', 'dry_run', 1, $2, $3, $4::text, case when $4::text is null then null else 'INV-1' end,
         case when $5::text is null then null else 'clear' end, $5::text)
       returning id`,
      [reference, state, lastErrorClass, providerId, reviewReason],
    );
    const id = result.rows[0]?.id as string;
    ids.push(id);
    return id;
  };
  const ids: string[] = [];
  try {
    const failed = await insert(`LAX-BID-INV-f-${suffix}`, "failed", "contract_refused", null);
    const issued = await insert(`LAX-BID-INV-i-${suffix}`, "issued", null, "1");
    // The two review shapes the sender's withhold and read-back produce: nothing sent (requeueable),
    // and a provider document that is not ours (never requeueable).
    const withheld = await insert(
      `LAX-BID-INV-w-${suffix}`,
      "needs_review",
      null,
      null,
      "wrong organisation",
    );
    const differs = await insert(
      `LAX-BID-INV-d-${suffix}`,
      "needs_review",
      null,
      "2",
      "provider document differs from ours: reference",
    );
    return await fn({ failed, issued, withheld, differs });
  } finally {
    if (ids.length > 0) {
      await owner.query("delete from accounting_document where id = any($1::uuid[])", [ids]);
    }
    await owner.end();
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

  it("reads only the artwork, artist and party columns the unlinked originals report needs", async () => {
    await withApiClient(async (client) => {
      for (const [tableName, granted] of API_UNLINKED_ORIGINALS_READ_COLUMNS) {
        // No table-level privilege: the shop tables stay denied as a whole.
        const table = await readTablePrivileges(
          client,
          [tableName],
          ["SELECT", "INSERT", "UPDATE", "DELETE", "TRUNCATE", "REFERENCES", "TRIGGER"],
        );
        expectTablePrivileges(table, () => false);
        const columns = await client.query<{
          column_name: string;
          can_select: boolean;
          can_write: boolean;
        }>(
          `select column_name::text,
                  has_column_privilege(current_user, format('public.%I', $1::text), column_name, 'SELECT') as can_select,
                  has_column_privilege(current_user, format('public.%I', $1::text), column_name, 'INSERT')
                    or has_column_privilege(current_user, format('public.%I', $1::text), column_name, 'UPDATE')
                    or has_column_privilege(current_user, format('public.%I', $1::text), column_name, 'REFERENCES') as can_write
             from information_schema.columns
            where table_schema = 'public' and table_name = $1`,
          [tableName],
        );
        const readable = columns.rows.filter((row) => row.can_select).map((row) => row.column_name);
        expect(readable.sort(), tableName).toEqual([...granted].sort());
        expect(
          columns.rows.filter((row) => row.can_write).map((row) => row.column_name),
          tableName,
        ).toEqual([]);
      }
      // The report's own shape: the live originals with their artist's name, and the count.
      await client.query(
        `select a.id, a.title, p.display_name
           from shop_artwork a
           join shop_artist ar on a.artist_id = ar.id
           join shop_party p on ar.party_id = p.id
          where a.zoho_product_id is null and a.sales_channel = 'art' and a.run_kind is null
            and a.eligible_for_edition_allocation = false and a.published_at is not null
            and a.archived_at is null
          limit 1`,
      );
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

  it("reads accounting documents, requeues one by its state columns, adds to its history, and only reads the switch", async () => {
    await withApiClient(async (client) => {
      const privileges = ["SELECT", "INSERT", "UPDATE", "DELETE"];
      const documents = await readTablePrivileges(client, ["accounting_document"], privileges);
      // UPDATE is by column (below), so the table-level check sees SELECT alone.
      expectTablePrivileges(documents, (row) => row.privilege === "SELECT");
      const columns = await client.query<{ column_name: string; allowed: boolean }>(
        `select column_name::text,
                has_column_privilege(current_user, 'public.accounting_document', column_name, 'UPDATE') as allowed
           from information_schema.columns
          where table_schema = 'public' and table_name = 'accounting_document'`,
      );
      const updatable = columns.rows.filter((row) => row.allowed).map((row) => row.column_name);
      expect(updatable.sort()).toEqual([...API_ACCOUNTING_REQUEUE_COLUMNS].sort());
      for (const fixed of ["payload", "net_pence", "gross_pence", "lax_reference", "provider"]) {
        expect(updatable, fixed).not.toContain(fixed);
      }
      const history = await readTablePrivileges(client, ["accounting_document_event"], privileges);
      expectTablePrivileges(history, (row) => ["SELECT", "INSERT"].includes(row.privilege));
      const settings = await readTablePrivileges(client, API_ACCOUNTING_SETTING_TABLES, privileges);
      expectTablePrivileges(settings, (row) => row.privilege === "SELECT");
      const column = await client.query<{ allowed: boolean }>(
        `select has_column_privilege(current_user, 'public.accounting_source_setting', 'books_mode', 'UPDATE') as allowed`,
      );
      expect(column.rows[0]).toEqual({ allowed: false });
    });
  });

  it.skipIf(!OWNER_URL)(
    "can only requeue a document and record who asked: never forge an outcome, a Books id or history",
    async () => {
      await withOwnerDocuments(async ({ failed, issued, withheld, differs }) => {
        await withApiClient(async (client) => {
          await client.query("BEGIN");
          try {
            const forbidden: [string, string, unknown[]][] = [
              [
                "forge an issued outcome with a Books id",
                `update accounting_document set state = 'issued', provider_id = 'ATTACKER-9',
                   provider_number = 'INV-FORGED', lease_token = null where id = $1`,
                [failed],
              ],
              [
                "set a Books document id while requeueing",
                `update accounting_document set state = 'pending', provider_id = '123',
                   provider_number = 'INV-1' where id = $1`,
                [failed],
              ],
              [
                "reset the attempts",
                `update accounting_document set state = 'pending', attempts = 0 where id = $1`,
                [failed],
              ],
              [
                "rewrite the last error",
                `update accounting_document set state = 'pending', last_error_class = null where id = $1`,
                [failed],
              ],
              [
                "move to any state but pending",
                `update accounting_document set state = 'cancelled' where id = $1`,
                [failed],
              ],
              [
                "requeue a document the provider already issued",
                `update accounting_document set state = 'pending', provider_id = null,
                   provider_number = null, pdf_ref = null where id = $1`,
                [issued],
              ],
              [
                "requeue a document whose provider document differs from ours",
                `update accounting_document set state = 'pending', provider_id = null,
                   provider_number = null, pdf_ref = null, review_lookup = null,
                   needs_review_reason = null where id = $1`,
                [differs],
              ],
              [
                "add a history row of another kind",
                `insert into accounting_document_event
                   (document_id, action, from_state, to_state, attempts, detail, occurred_at)
                 values ($1, 'complete_sending', 'sending', 'issued', 1, '{"requestedBy":"not-real"}', now())`,
                [failed],
              ],
              [
                "add a requeue row for a document that was not requeued",
                `insert into accounting_document_event
                   (document_id, action, from_state, to_state, attempts, detail, occurred_at)
                 values ($1, 'requeue', 'failed', 'pending', 1, '{"requestedBy":"staff-1"}', now())`,
                [failed],
              ],
            ];
            for (const [what, text, values] of forbidden) {
              expect(await probe(client, text, values), what).toBe("42501");
            }

            // The real requeue, as the persistence layer writes it, and its history row.
            const requeue = `update accounting_document set state = 'pending', attempts = 1,
                lease_token = null, lease_expires_at = null, settles_at = null, review_lookup = null,
                needs_review_reason = null, provider_id = null, provider_number = null, pdf_ref = null,
                mismatch_field = null, mismatch_difference_pence = null,
                last_error_class = 'contract_refused', updated_at = now()
              where id = $1`;
            expect(await probe(client, requeue, [failed])).toBeUndefined();
            const historyRow = (detail: string) =>
              probe(
                client,
                `insert into accounting_document_event
                   (document_id, action, from_state, to_state, attempts, detail, occurred_at)
                 values ($1, 'requeue', 'failed', 'pending', 1, $2::jsonb, now())`,
                [failed, detail],
              );
            expect(await historyRow("{}"), "without who asked").toBe("42501");
            expect(await historyRow('{"requestedBy":""}'), "with an empty actor").toBe("42501");
            expect(
              await historyRow('{"requestedBy":"staff-1","outcome":"issued"}'),
              "with anything beside who asked",
            ).toBe("42501");
            expect(await historyRow('{"requestedBy":"staff-1"}')).toBeUndefined();

            // A withheld send (nothing reached the provider) may be tried again, like a failure.
            const requeueWithheld = `update accounting_document set state = 'pending', attempts = 1,
                lease_token = null, lease_expires_at = null, settles_at = null, review_lookup = null,
                needs_review_reason = null, provider_id = null, provider_number = null, pdf_ref = null,
                mismatch_field = null, mismatch_difference_pence = null, updated_at = now()
              where id = $1`;
            expect(await probe(client, requeueWithheld, [withheld])).toBeUndefined();
          } finally {
            await client.query("ROLLBACK");
          }
        });
      });
    },
  );

  it("adds seller terms, reads them, may re-price only their figures, and only reads the finance settings", async () => {
    await withApiClient(async (client) => {
      const privileges = ["SELECT", "INSERT", "UPDATE", "DELETE"];
      const terms = await readTablePrivileges(
        client,
        SELLER_TERMS_INSERT_SELECT_TABLES,
        privileges,
      );
      expectTablePrivileges(terms, (row) => ["SELECT", "INSERT"].includes(row.privilege));
      const settings = await readTablePrivileges(client, FINANCE_SETTING_READ_TABLES, privileges);
      expectTablePrivileges(settings, (row) => row.privilege === "SELECT");
      // Settlement re-prices a held sale over its row: the figures only, never what the row is for.
      for (const column of SELLER_TERMS_PROBE_COLUMNS) {
        const allowed = await client.query<{ allowed: boolean }>(
          `select has_column_privilege(current_user, 'public.sale_seller_terms', $1, 'UPDATE') as allowed`,
          [column],
        );
        expect(allowed.rows[0]?.allowed, column).toBe(
          (SELLER_TERMS_RECOMPUTE_UPDATE_COLUMNS as readonly string[]).includes(column),
        );
      }
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

  it("appends refund reversals and reads them, never changing or removing one", async () => {
    await withApiClient(async (client) => {
      const rows = await readTablePrivileges(
        client,
        ["stripe_refund_reversal"],
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
