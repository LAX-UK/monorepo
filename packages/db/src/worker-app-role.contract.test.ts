import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import pg from "pg";
import { describe, expect, it } from "vitest";
import { readUserReadCutoverFromEnv } from "./applied-user-read-cutover.js";
import { createDb } from "./client.js";
import {
  WORKER_DENY_TABLES,
  WORKER_EMAIL_SUPPRESSION_UPDATE_COLUMNS,
  WORKER_REOFFER_TABLES,
  WORKER_REOFFER_UPDATE_COLUMNS,
  WORKER_SHOP_ENQUIRY_READ_COLUMNS,
  WORKER_SHOP_ORDER_READ_COLUMNS,
  WORKER_SHOP_PRINT_GROUP_READ_COLUMNS,
  WORKER_ZOHO_BOOKS_INSERT_COLUMNS,
  WORKER_ZOHO_BOOKS_SELECT_COLUMNS,
  WORKER_ZOHO_BOOKS_UPDATE_COLUMNS,
} from "./migrate-roles.js";
import {
  expectTablePrivileges,
  expectUniformTablePrivileges,
  readTablePrivileges,
} from "./role-contract/table-privileges.test-helpers.js";
import { expectZohoBooksConnectionGrants } from "./role-contract/zoho-books-connection-privileges.test-helpers.js";
import {
  absenteeBid,
  bid,
  domainEvent,
  domainEventDelivery,
  failedJobs,
  lotLifecycleSnapshot,
  notificationOutbox,
  payment,
  payout,
  payoutLine,
} from "./schema/index.js";
import { buildPgConnectionConfig } from "./ssl.js";

const WORKER_URL = process.env.DATABASE_URL_WORKER ?? process.env.WORKER_APP_DATABASE_URL;
const { Client } = pg;

async function withWorkerClient<T>(fn: (client: pg.Client) => Promise<T>): Promise<T> {
  if (!WORKER_URL) throw new Error("DATABASE_URL_WORKER is required");
  const client = new Client(buildPgConnectionConfig(WORKER_URL));
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

/** Cutover gate: worker_app can perform delivery, payment maintenance, and lifecycle writes. */
describe.skipIf(!WORKER_URL)("worker_app role contract", { timeout: 60_000 }, () => {
  it("holds only the token columns it reads and writes on the Zoho Books connections, never DELETE or TRUNCATE", async () => {
    await withWorkerClient(async (client) => {
      await expectZohoBooksConnectionGrants(client, {
        select: [...WORKER_ZOHO_BOOKS_SELECT_COLUMNS],
        insert: [...WORKER_ZOHO_BOOKS_INSERT_COLUMNS],
        update: [...WORKER_ZOHO_BOOKS_UPDATE_COLUMNS],
      });
    });
  });

  it("adds to buyer refunds and reads them, never changing or removing one", async () => {
    await withWorkerClient(async (client) => {
      const rows = await readTablePrivileges(
        client,
        ["payment_refund"],
        ["SELECT", "INSERT", "UPDATE", "DELETE"],
      );
      expectTablePrivileges(rows, (row) => ["SELECT", "INSERT"].includes(row.privilege));
    });
  });

  it("reads re-offers and seller answers and updates only where a request or offer stands", async () => {
    await withWorkerClient(async (client) => {
      const rows = await readTablePrivileges(
        client,
        [...WORKER_REOFFER_TABLES],
        ["SELECT", "INSERT", "UPDATE", "DELETE"],
      );
      // UPDATE is granted by column, so the table-level check sees SELECT only.
      expectTablePrivileges(rows, (row) => row.privilege === "SELECT");
      for (const table of WORKER_REOFFER_TABLES) {
        const columns = await client.query<{ column_name: string; allowed: boolean }>(
          `select column_name,
                  has_column_privilege(current_user, 'public.' || $1, column_name, 'UPDATE') as allowed
             from information_schema.columns
            where table_schema = 'public' and table_name = $1`,
          [table],
        );
        const updatable = columns.rows.filter((row) => row.allowed).map((row) => row.column_name);
        expect(updatable.sort(), table).toEqual([...WORKER_REOFFER_UPDATE_COLUMNS[table]].sort());
      }
      // Written out, so widening a grant is a visible change here and not only in the constant:
      // the status moves a sweep makes, a lapse (an answer given by the clock) and the reminder.
      const updatableOf = async (table: string) =>
        (
          await client.query<{ column_name: string }>(
            `select column_name from information_schema.columns
              where table_schema = 'public' and table_name = $1
                and has_column_privilege(current_user, 'public.' || $1, column_name, 'UPDATE')
              order by column_name`,
            [table],
          )
        ).rows.map((row) => row.column_name);
      expect(await updatableOf("lot_reoffer")).toEqual([
        "close_reason",
        "closed_by",
        "status",
        "updated_at",
      ]);
      expect(await updatableOf("seller_consent")).toEqual([
        "answered_at",
        "answered_by_user_id",
        "channel",
        "note",
        "preferred_next",
        "reminded_at",
        "status",
      ]);
    });
  });

  it("has no DML privileges on Identity and receiver-local tables", async () => {
    const cutover = await readUserReadCutoverFromEnv();
    await withWorkerClient(async (client) => {
      const rows = await readTablePrivileges(client, WORKER_DENY_TABLES, [
        "SELECT",
        "INSERT",
        "UPDATE",
        "DELETE",
      ]);
      expectTablePrivileges(rows, (row) =>
        row.table_name === "user" && row.privilege === "SELECT"
          ? !cutover.workerUserSelectRevoked
          : false,
      );
    });
  });

  it("reads the Shop enquiry columns the CRM Lead needs, and no other column of those tables", async () => {
    await withWorkerClient(async (client) => {
      for (const [table, columns] of WORKER_SHOP_ENQUIRY_READ_COLUMNS) {
        const all = await client.query<{ column_name: string; allowed: boolean }>(
          `select column_name,
                  has_column_privilege(current_user, 'public.' || $1, column_name, 'SELECT') as allowed
             from information_schema.columns
            where table_schema = 'public' and table_name = $1`,
          [table],
        );
        const allowed = all.rows.filter((row) => row.allowed).map((row) => row.column_name);
        // Another read grant may add columns of the same table (the print group reads shop_artwork).
        const shared = WORKER_SHOP_PRINT_GROUP_READ_COLUMNS.filter(
          ([name]) => name === table,
        ).flatMap(([, more]) => [...more]);
        expect(allowed.sort(), table).toEqual([...new Set([...columns, ...shared])].sort());
        const whole = await readTablePrivileges(client, [table], ["INSERT", "UPDATE", "DELETE"]);
        expectUniformTablePrivileges(whole, false);
      }
    });
  });

  it("reads the Shop columns a print group needs, and no whole Shop table", async () => {
    await withWorkerClient(async (client) => {
      for (const [table, columns] of WORKER_SHOP_PRINT_GROUP_READ_COLUMNS) {
        for (const column of columns) {
          const result = await client.query<{ allowed: boolean }>(
            "select has_column_privilege(current_user, 'public.' || $1, $2, 'SELECT') as allowed",
            [table, column],
          );
          expect(result.rows[0]?.allowed, `${table}.${column}`).toBe(true);
        }
        const whole = await readTablePrivileges(client, [table], ["INSERT", "UPDATE", "DELETE"]);
        expectUniformTablePrivileges(whole, false);
      }
    });
  });

  it("updates only the reason, source and created_at of a suppression, and cannot delete one", async () => {
    await withWorkerClient(async (client) => {
      const columns = await client.query<{ column_name: string; allowed: boolean }>(
        `select column_name,
                has_column_privilege(current_user, 'public.email_suppression', column_name, 'UPDATE') as allowed
           from information_schema.columns
          where table_schema = 'public' and table_name = 'email_suppression'`,
      );
      const updatable = columns.rows.filter((row) => row.allowed).map((row) => row.column_name);
      expect(updatable.sort()).toEqual([...WORKER_EMAIL_SUPPRESSION_UPDATE_COLUMNS].sort());
      const whole = await client.query<{ update: boolean; insert: boolean; del: boolean }>(
        `select has_table_privilege(current_user, 'public.email_suppression', 'UPDATE') as update,
                has_table_privilege(current_user, 'public.email_suppression', 'INSERT') as insert,
                has_table_privilege(current_user, 'public.email_suppression', 'DELETE') as del`,
      );
      expect(whole.rows[0]).toEqual({ update: false, insert: true, del: false });
    });
  });

  it("lifts an opt-out only through the definer function, and reads the lift record", async () => {
    await withWorkerClient(async (client) => {
      const result = await client.query<{ run: boolean; select: boolean; write: boolean }>(
        `select has_function_privilege(current_user, 'public.lift_zoho_campaigns_opt_out(text, timestamptz, boolean)', 'EXECUTE') as run,
                has_table_privilege(current_user, 'public.zoho_campaigns_optout_lift', 'SELECT') as select,
                (has_table_privilege(current_user, 'public.zoho_campaigns_optout_lift', 'INSERT')
                 or has_table_privilege(current_user, 'public.zoho_campaigns_optout_lift', 'UPDATE')) as write`,
      );
      expect(result.rows[0]).toEqual({ run: true, select: true, write: false });
    });
  });

  it("reads and writes the sealed Xero token columns, and may null the plaintext ones", async () => {
    await withWorkerClient(async (client) => {
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
    await withWorkerClient(async (client) => {
      const result = await client.query<{ run: boolean }>(
        `select has_function_privilege(current_user, 'public.payment_refund_backfill_from_payout_lines(uuid)', 'EXECUTE') as run`,
      );
      expect(result.rows[0]).toEqual({ run: true });
    });
  });

  it("reads the Shop order columns the Deal name needs, and no other column of those tables", async () => {
    await withWorkerClient(async (client) => {
      for (const [table, columns] of WORKER_SHOP_ORDER_READ_COLUMNS) {
        const all = await client.query<{ column_name: string; allowed: boolean }>(
          `select column_name,
                  has_column_privilege(current_user, 'public.' || $1, column_name, 'SELECT') as allowed
             from information_schema.columns
            where table_schema = 'public' and table_name = $1`,
          [table],
        );
        const allowed = all.rows.filter((row) => row.allowed).map((row) => row.column_name);
        expect(allowed.sort(), table).toEqual([...columns].sort());
        const whole = await readTablePrivileges(client, [table], ["INSERT", "UPDATE", "DELETE"]);
        expectUniformTablePrivileges(whole, false);
      }
    });
  });

  it("has the DML required by each product identity projection", async () => {
    // biome-ignore lint/style/noNonNullAssertion: gated by skipIf
    const db = createDb(WORKER_URL!);
    const privileges = await db.execute(sql`
      SELECT
        has_table_privilege(current_user, 'public.bid_user_profile', 'INSERT') AS can_insert,
        has_table_privilege(current_user, 'public.bid_user_profile', 'SELECT') AS can_select,
        has_table_privilege(current_user, 'public.bid_user_profile', 'UPDATE') AS can_update
    `);
    expect(privileges.rows[0]).toMatchObject({
      can_insert: true,
      can_select: true,
      can_update: true,
    });
    const shopPrivileges = await db.execute(sql`
      SELECT
        has_table_privilege(current_user, 'public.shop_user_profile', 'INSERT') AS can_insert,
        has_table_privilege(current_user, 'public.shop_user_profile', 'SELECT') AS can_select,
        has_table_privilege(current_user, 'public.shop_user_profile', 'UPDATE') AS can_update,
        has_table_privilege(current_user, 'public.shop_user_profile', 'DELETE') AS can_delete
    `);
    expect(shopPrivileges.rows[0]).toMatchObject({
      can_insert: true,
      can_select: true,
      can_update: true,
      can_delete: false,
    });
    const directoryPrivileges = await db.execute(sql`
      SELECT
        has_table_privilege(
          current_user,
          'public.bid_identity_directory',
          'INSERT'
        ) AS can_insert,
        has_table_privilege(
          current_user,
          'public.bid_identity_directory',
          'SELECT'
        ) AS can_select,
        has_table_privilege(
          current_user,
          'public.bid_identity_directory',
          'UPDATE'
        ) AS can_update,
        has_table_privilege(
          current_user,
          'public.bid_identity_directory',
          'DELETE'
        ) AS can_delete
    `);
    expect(directoryPrivileges.rows[0]).toMatchObject({
      can_insert: true,
      can_select: true,
      can_update: true,
      can_delete: true,
    });
  });

  it("can erase email-only alert subscribers on purge and prune its own alert topics, matches and digests", async () => {
    await withWorkerClient(async (client) => {
      const rows = await readTablePrivileges(
        client,
        ["bid_alert_subscriber", "visitor_sale_alert_subscriber"],
        ["SELECT", "DELETE"],
      );
      expectUniformTablePrivileges(rows, true);
      const topics = await readTablePrivileges(
        client,
        ["bid_alert_topic", "bid_alert_match", "bid_alert_digest"],
        ["SELECT", "DELETE"],
      );
      // The alert retention prune deletes stale topics, matches and digests; nothing else.
      expectUniformTablePrivileges(topics, true);
      const writes = await readTablePrivileges(
        client,
        ["bid_alert_topic", "bid_alert_match", "bid_alert_digest"],
        ["TRUNCATE"],
      );
      expectUniformTablePrivileges(writes, false);
    });
  });

  it("can lease domain_event_delivery and append domain_events", async () => {
    // biome-ignore lint/style/noNonNullAssertion: gated by skipIf
    const db = createDb(WORKER_URL!);
    const consumer = `contract-test-${randomUUID()}`;

    await db
      .transaction(async (tx) => {
        const [inserted] = await tx
          .insert(domainEvent)
          .values({
            aggregateType: "lot",
            aggregateId: randomUUID(),
            eventType: "lot.activated",
            payload: { probe: true },
            schemaVersion: 1,
            producer: "worker_app_role_contract",
          })
          .returning({ id: domainEvent.id });

        await tx.insert(domainEventDelivery).values({
          consumer,
          eventId: inserted.id,
          status: "pending",
        });
        await tx
          .update(domainEventDelivery)
          .set({ status: "succeeded", updatedAt: new Date() })
          .where(sql`${domainEventDelivery.consumer} = ${consumer}`);
        throw new Error("rollback_role_contract");
      })
      .catch((err: unknown) => {
        if (!(err instanceof Error) || err.message !== "rollback_role_contract") throw err;
      });
  });

  it("can read payment rows (expire-stale-payments path)", async () => {
    // biome-ignore lint/style/noNonNullAssertion: gated by skipIf
    const db = createDb(WORKER_URL!);
    await db.select({ id: payment.id }).from(payment).limit(1);
  });

  it("can raise an invoice: payment, fulfilment and source-of-funds rows (lot end path)", async () => {
    // biome-ignore lint/style/noNonNullAssertion: gated by skipIf
    const db = createDb(WORKER_URL!);
    const granted = await db.execute(sql`
      select
        has_table_privilege(current_user, 'payment', 'INSERT') as payment,
        has_table_privilege(current_user, 'lot_fulfilment', 'INSERT') as fulfilment_insert,
        has_table_privilege(current_user, 'lot_fulfilment', 'UPDATE') as fulfilment_update,
        has_table_privilege(current_user, 'source_of_funds', 'INSERT') as source_of_funds,
        has_table_privilege(current_user, 'payment', 'DELETE') as payment_delete,
        has_table_privilege(current_user, 'payment', 'TRUNCATE') as payment_truncate,
        has_table_privilege(current_user, 'lot_fulfilment', 'DELETE') as fulfilment_delete,
        has_table_privilege(current_user, 'lot_fulfilment', 'TRUNCATE') as fulfilment_truncate
    `);
    expect(granted.rows[0]).toEqual({
      payment: true,
      fulfilment_insert: true,
      fulfilment_update: true,
      source_of_funds: true,
      payment_delete: false,
      payment_truncate: false,
      fulfilment_delete: false,
      fulfilment_truncate: false,
    });
  });

  it("can read notification_outbox (lifecycle staging drain path)", async () => {
    // biome-ignore lint/style/noNonNullAssertion: gated by skipIf
    const db = createDb(WORKER_URL!);
    await db.select({ id: notificationOutbox.id }).from(notificationOutbox).limit(1);
  });

  it("can take row locks on lot (FOR UPDATE lifecycle path)", async () => {
    // biome-ignore lint/style/noNonNullAssertion: gated by skipIf
    const db = createDb(WORKER_URL!);
    await db.execute(sql`SELECT id FROM lot LIMIT 1 FOR UPDATE SKIP LOCKED`);
    expect(true).toBe(true);
  });

  it("can insert payout and payout_line for settlement (rolled back)", async () => {
    // biome-ignore lint/style/noNonNullAssertion: gated by skipIf
    const db = createDb(WORKER_URL!);
    const entityRows = await db.execute(sql`SELECT id FROM legal_entity LIMIT 1`);
    const legalEntityId = (entityRows.rows[0] as { id?: string } | undefined)?.id;
    if (!legalEntityId) {
      if (process.env.WORKER_ROLE_CONTRACT_REQUIRED === "true") {
        expect.fail("seed legal_entity for worker role contract");
      }
      return;
    }

    await db
      .transaction(async (tx) => {
        const [po] = await tx
          .insert(payout)
          .values({
            legalEntityId,
            periodStart: new Date("2026-01-01"),
            periodEnd: new Date("2026-01-31"),
            grossAmount: "1.00",
            platformFee: "0.00",
            stripeFee: "0.00",
            netAmount: "1.00",
            currency: "GBP",
            status: "scheduled",
          })
          .returning({ id: payout.id });
        await tx.insert(payoutLine).values({
          payoutId: po.id,
          paymentId: null,
          amount: "1.00",
          kind: "refund",
          note: "role_contract_probe",
        });
        throw new Error("rollback_role_contract");
      })
      .catch((err: unknown) => {
        if (!(err instanceof Error) || err.message !== "rollback_role_contract") throw err;
      });
  });

  it("cannot insert into session (auth-only table)", async () => {
    // biome-ignore lint/style/noNonNullAssertion: gated by skipIf
    const db = createDb(WORKER_URL!);
    await expect(
      db.execute(sql`
        INSERT INTO session (id, user_id, token, expires_at, created_at, updated_at)
        VALUES (${randomUUID()}, ${randomUUID()}, 'probe', NOW(), NOW(), NOW())
      `),
    ).rejects.toThrow();
  });

  it("cannot insert absentee_bid rows (worker updates only)", async () => {
    // biome-ignore lint/style/noNonNullAssertion: gated by skipIf
    const db = createDb(WORKER_URL!);
    const probe = await db.execute(sql`
      SELECT l.id AS lot_id, d.subject_id AS user_id, le.id AS legal_entity_id
      FROM lot l
      CROSS JOIN bid_identity_directory d
      CROSS JOIN legal_entity le
      LIMIT 1
    `);
    const row = probe.rows[0] as
      | { lot_id?: string; user_id?: string; legal_entity_id?: string }
      | undefined;
    if (!row?.lot_id || !row.user_id || !row.legal_entity_id) {
      if (process.env.WORKER_ROLE_CONTRACT_REQUIRED === "true") {
        expect.fail("seed lot, user, and legal_entity for worker absentee contract probe");
      }
      return;
    }

    await expect(
      db.insert(absenteeBid).values({
        lotId: row.lot_id,
        userId: row.user_id,
        buyerLegalEntityId: row.legal_entity_id,
        maxAmount: "1.00",
        status: "scheduled",
      }),
    ).rejects.toThrow();
  });

  it("can insert bid with internal_placement_key (rolled back)", async () => {
    // biome-ignore lint/style/noNonNullAssertion: gated by skipIf
    const db = createDb(WORKER_URL!);
    const probe = await db.execute(sql`
      SELECT l.id AS lot_id, d.subject_id AS user_id, le.id AS legal_entity_id
      FROM lot l
      CROSS JOIN bid_identity_directory d
      CROSS JOIN legal_entity le
      LIMIT 1
    `);
    const row = probe.rows[0] as
      | { lot_id?: string; user_id?: string; legal_entity_id?: string }
      | undefined;
    if (!row?.lot_id || !row.user_id || !row.legal_entity_id) {
      if (process.env.WORKER_ROLE_CONTRACT_REQUIRED === "true") {
        expect.fail("seed lot, user, and legal_entity for worker absentee contract probe");
      }
      return;
    }

    const lotId = row.lot_id;
    const bidderId = row.user_id;
    const buyerLegalEntityId = row.legal_entity_id;
    const placementKey = `contract:${randomUUID()}`;
    await db
      .transaction(async (tx) => {
        await tx.insert(bid).values({
          lotId,
          bidderId,
          subjectId: bidderId,
          buyerLegalEntityId,
          amount: "1.00",
          internalPlacementKey: placementKey,
        });
        throw new Error("rollback_role_contract");
      })
      .catch((err: unknown) => {
        if (!(err instanceof Error) || err.message !== "rollback_role_contract") throw err;
      });
  });

  it("cannot delete bid rows", async () => {
    // biome-ignore lint/style/noNonNullAssertion: gated by skipIf
    const db = createDb(WORKER_URL!);
    const existing = await db.execute(sql`SELECT id FROM bid LIMIT 1`);
    const bidId = (existing.rows[0] as { id?: string } | undefined)?.id;
    if (!bidId) {
      expect(process.env.WORKER_ROLE_CONTRACT_REQUIRED).not.toBe("true");
      return;
    }
    await expect(db.execute(sql`DELETE FROM bid WHERE id = ${bidId}`)).rejects.toThrow();
  });

  it("can upsert lot_lifecycle_snapshot (rolled back)", async () => {
    // biome-ignore lint/style/noNonNullAssertion: gated by skipIf
    const db = createDb(WORKER_URL!);
    const probe = await db.execute(sql`
      SELECT l.id AS lot_id
      FROM lot l
      LIMIT 1
    `);
    const lotId = (probe.rows[0] as { lot_id?: string } | undefined)?.lot_id;
    if (!lotId) {
      if (process.env.WORKER_ROLE_CONTRACT_REQUIRED === "true") {
        expect.fail("seed lot row for worker lifecycle snapshot contract probe");
      }
      return;
    }

    await db
      .transaction(async (tx) => {
        await tx
          .insert(lotLifecycleSnapshot)
          .values({
            lotId,
            currentStatus: "active",
            lastEventType: "lot.activated",
            lastEventAt: new Date(),
            attachedCount: 0,
            returnCount: 0,
          })
          .onConflictDoUpdate({
            target: lotLifecycleSnapshot.lotId,
            set: { lastEventType: "lot.activated", updatedAt: new Date() },
          });
        throw new Error("rollback_role_contract");
      })
      .catch((err: unknown) => {
        if (!(err instanceof Error) || err.message !== "rollback_role_contract") throw err;
      });
  });

  it("can insert failed_jobs audit row (rolled back)", async () => {
    // biome-ignore lint/style/noNonNullAssertion: gated by skipIf
    const db = createDb(WORKER_URL!);
    const auditId = `contract:${randomUUID()}`;
    await db
      .transaction(async (tx) => {
        await tx.insert(failedJobs).values({
          id: auditId,
          originalQueue: "lot-lifecycle",
          originalJobId: "job-probe",
          originalJobName: "activate",
          payloadJson: "{}",
          errorMessage: "probe",
          attempts: 3,
          failedAt: new Date(),
        });
        throw new Error("rollback_role_contract");
      })
      .catch((err: unknown) => {
        if (!(err instanceof Error) || err.message !== "rollback_role_contract") throw err;
      });
  });
  it("reads every table the collection reminder sweeps and the lot facts they check use", async () => {
    // Only SELECT: the sweeps read, and email through the outbox. A table missing here makes every
    // reminder group fail with "permission denied", which the sweep logs and carries on from.
    const tables = [
      "lot",
      "lot_fulfilment",
      "sale",
      "venue",
      "collection_place",
      "collection_booking",
      "collection_booking_lot",
      "payment",
      "payment_refund_reconcile",
      "delivery_quote",
      "dispute_case",
      "dispute_case_candidate",
      "source_of_funds",
      "bid_user_profile",
      "bid_identity_directory",
      "legal_entity",
      "legal_entity_member",
      "email_outbox",
    ];
    await withWorkerClient(async (client) => {
      for (const table of tables) {
        const result = await client.query<{ allowed: boolean }>(
          "select has_table_privilege(current_user, 'public.' || $1, 'SELECT') as allowed",
          [table],
        );
        expect(result.rows[0]?.allowed, table).toBe(true);
      }
    });
  });
});

describe("worker_app role contract (static cutover gate)", () => {
  it("requires DATABASE_URL_WORKER in CI cutover jobs", () => {
    expect(
      process.env.CI === "true" && process.env.WORKER_ROLE_CONTRACT_REQUIRED === "true"
        ? Boolean(WORKER_URL)
        : true,
    ).toBe(true);
  });

  it("documents worker finance integration tables for migrate-roles", async () => {
    const {
      WORKER_FINANCE_INTEGRATION_TABLES,
      WORKER_DISPLAY_PAIRING_TABLES,
      WORKER_PAYOUT_SETTLEMENT_TABLES,
      WORKER_LEGAL_ENTITY_CONNECT_SETTLEMENT_COLUMNS,
    } = await import("./migrate-roles.js");
    expect(WORKER_FINANCE_INTEGRATION_TABLES).toContain("xero_connection");
    expect(WORKER_FINANCE_INTEGRATION_TABLES).toContain("payment_refund_reconcile");
    expect(WORKER_DISPLAY_PAIRING_TABLES).toContain("saleroom_display_pairing");
    expect(WORKER_PAYOUT_SETTLEMENT_TABLES).toEqual(["payout", "payout_line"]);
    expect(WORKER_LEGAL_ENTITY_CONNECT_SETTLEMENT_COLUMNS.length).toBeGreaterThan(0);
  });

  it("documents worker lifecycle absentee and bid grants for migrate-roles", async () => {
    const {
      WORKER_ABSENTEE_BID_TABLES,
      WORKER_BID_PLACEMENT_TABLES,
      WORKER_LIFECYCLE_READ_TABLES,
      WORKER_LIFECYCLE_SNAPSHOT_TABLES,
      WORKER_FAILED_JOBS_TABLES,
    } = await import("./migrate-roles.js");
    expect(WORKER_ABSENTEE_BID_TABLES).toEqual(["absentee_bid"]);
    expect(WORKER_BID_PLACEMENT_TABLES).toEqual(["bid"]);
    expect(WORKER_LIFECYCLE_READ_TABLES).toContain("watchlist");
    expect(WORKER_LIFECYCLE_SNAPSHOT_TABLES).toEqual(["lot_lifecycle_snapshot"]);
    expect(WORKER_FAILED_JOBS_TABLES).toEqual(["failed_jobs"]);
  });

  it("denies worker_app writes to auth session table (static grant model)", async () => {
    const { AUTH_FULL_TABLES, WORKER_DENY_TABLES } = await import("./migrate-roles.js");
    expect(AUTH_FULL_TABLES).toContain("session");
    expect(AUTH_FULL_TABLES).toContain("oidc_rp_session");
    expect(AUTH_FULL_TABLES).toContain("oidc_backchannel_logout_delivery");
    expect(AUTH_FULL_TABLES).toContain("ssf_stream");
    expect(WORKER_DENY_TABLES).toContain("oidc_rp_session");
    expect(WORKER_DENY_TABLES).toContain("ssf_stream");
    expect(WORKER_DENY_TABLES).toContain("bid_ssf_replay");
  });

  it("grants worker_app product profile projection tables", async () => {
    const { WORKER_PRODUCT_PROFILE_TABLES } = await import("./migrate-roles.js");
    expect(WORKER_PRODUCT_PROFILE_TABLES).toEqual([
      "shop_user_profile",
      "bid_user_profile",
      "bid_identity_directory",
    ]);
    expect(WORKER_PRODUCT_PROFILE_TABLES).not.toContain("shop_identity_session");
  });

  it("denies worker_app direct user reads after the directory cutover", async () => {
    const { WORKER_DENY_TABLES, WORKER_READ_TABLES } = await import("./migrate-roles.js");
    expect(WORKER_DENY_TABLES).toContain("user");
    expect(WORKER_READ_TABLES).not.toContain("user");
  });
});
