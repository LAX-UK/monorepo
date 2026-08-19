import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { createDb } from "./client.js";
import { WORKER_DENY_TABLES } from "./migrate-roles.js";
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

const WORKER_URL = process.env.DATABASE_URL_WORKER ?? process.env.WORKER_APP_DATABASE_URL;

/** Cutover gate: worker_app can perform delivery, payment maintenance, and lifecycle writes. */
describe.skipIf(!WORKER_URL)("worker_app role contract", () => {
  it("has no DML privileges on Identity and receiver-local tables", async () => {
    // biome-ignore lint/style/noNonNullAssertion: gated by skipIf
    const db = createDb(WORKER_URL!);
    for (const table of WORKER_DENY_TABLES) {
      const privileges = await db.execute(sql`
        SELECT
          has_table_privilege(current_user, ${`public.${table}`}, 'SELECT') AS can_select,
          has_table_privilege(current_user, ${`public.${table}`}, 'INSERT') AS can_insert,
          has_table_privilege(current_user, ${`public.${table}`}, 'UPDATE') AS can_update,
          has_table_privilege(current_user, ${`public.${table}`}, 'DELETE') AS can_delete
      `);
      expect(privileges.rows[0], table).toMatchObject({
        can_select: false,
        can_insert: false,
        can_update: false,
        can_delete: false,
      });
    }
  });

  it("can provision and update product identity profiles without deleting them", async () => {
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
      SELECT l.id AS lot_id, u.id AS user_id, le.id AS legal_entity_id
      FROM lot l
      CROSS JOIN "user" u
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
      SELECT l.id AS lot_id, u.id AS user_id, le.id AS legal_entity_id
      FROM lot l
      CROSS JOIN "user" u
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
    expect(WORKER_PRODUCT_PROFILE_TABLES).toEqual(["shop_user_profile", "bid_user_profile"]);
    expect(WORKER_PRODUCT_PROFILE_TABLES).not.toContain("shop_identity_session");
  });
});
