import { randomUUID } from "node:crypto";
import { type Database, closeDb, createDb } from "@auction/db";
import { DrizzleZohoMirrorLedgerReader } from "@auction/persistence";
import type { ZohoMirrorState } from "@auction/shop-contracts";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { ZohoMirrorStatusService } from "../application/zoho-mirror/zoho-mirror-status.service.js";

const url = process.env.DATABASE_URL;

// The ledger tables are private copies in a schema of their own (first on the search path), so
// this file touches, and is touched by, no rows other integration files keep in the public ones.
const SCHEMA = `zoho_mirror_status_${randomUUID().replaceAll("-", "").slice(0, 12)}`;
const TABLES = ["domain_events", "domain_event_delivery"];
let db: Database = null as never;
let mirror: ZohoMirrorStatusService;

async function orderEvent(orderId: string, type = "shop.order.paid"): Promise<number> {
  const result = await db.execute(sql`
    INSERT INTO domain_events (aggregate_type, aggregate_id, event_type, payload, producer)
    VALUES ('shop_order', ${orderId}, ${type}, ${JSON.stringify({ schemaVersion: 1, orderId })}::jsonb, 'test')
    RETURNING id
  `);
  const rows = (Array.isArray(result) ? result : (result as { rows: unknown[] }).rows) as {
    id: number | string;
  }[];
  return Number(rows[0]?.id);
}

/** One delivery of a new event for the order, as the worker leaves it. */
async function delivery(
  orderId: string,
  status: string,
  extra: { error?: string; reference?: string; retryAt?: Date; attempts?: number } = {},
) {
  const eventId = await orderEvent(orderId);
  await db.execute(sql`
    INSERT INTO domain_event_delivery (consumer, event_id, status, attempts, provider_reference, last_error, next_retry_at)
    VALUES ('zoho_fulfilment', ${eventId}, ${status}, ${extra.attempts ?? 1},
      ${extra.reference ?? null}, ${extra.error ?? null}, ${extra.retryAt ?? null})
  `);
}

async function stateOf(orderId: string): Promise<ZohoMirrorState> {
  return (await mirror.status("order", orderId)).state;
}

describe.skipIf(!url)(
  "Zoho mirror status from the delivery ledger (Postgres)",
  { timeout: 30_000 },
  () => {
    beforeAll(async () => {
      const admin = createDb(url as string);
      try {
        await admin.execute(sql.raw(`CREATE SCHEMA "${SCHEMA}"`));
        for (const table of TABLES) {
          await admin.execute(
            sql.raw(`CREATE TABLE "${SCHEMA}"."${table}" (LIKE public."${table}" INCLUDING ALL)`),
          );
        }
      } finally {
        await closeDb(admin);
      }
      const target = new URL(url as string);
      target.searchParams.set("options", `-c search_path=${SCHEMA},public`);
      db = createDb(target.toString());
      mirror = new ZohoMirrorStatusService(new DrizzleZohoMirrorLedgerReader(db));
    });

    afterAll(async () => {
      await closeDb(db);
      const admin = createDb(url as string);
      try {
        await admin.execute(sql.raw(`DROP SCHEMA IF EXISTS "${SCHEMA}" CASCADE`));
      } finally {
        await closeDb(admin);
      }
    });

    beforeEach(async () => {
      await db.execute(
        sql.raw(`TRUNCATE "${SCHEMA}".domain_events, "${SCHEMA}".domain_event_delivery`),
      );
    });

    it("derives every state from the ledger, one order each, in one batched read", async () => {
      const [sent, waiting, dead, dry, unpaid, never] = Array.from({ length: 6 }, () =>
        randomUUID(),
      );
      await delivery(sent as string, "succeeded", { reference: "Order:LAX-S-10482" });
      await delivery(waiting as string, "retryable", {
        attempts: 2,
        retryAt: new Date("2026-11-14T16:10:00Z"),
      });
      await delivery(dead as string, "dead_lettered", {
        attempts: 5,
        error: "Zoho refused: INVALID_DATA",
      });
      await delivery(dry as string, "skipped", { error: "dry_run" });
      await delivery(unpaid as string, "skipped", { error: "order_not_paid" });

      const items = await mirror.statuses("order", [
        sent,
        waiting,
        dead,
        dry,
        unpaid,
        never,
      ] as string[]);

      expect(items.map((item) => item.state)).toEqual([
        "mirrored",
        "pending",
        "failed",
        "dry_run",
        "not_applicable",
        "not_applicable",
      ] satisfies ZohoMirrorState[]);
      expect(items[0]).toMatchObject({ providerReference: "Order:LAX-S-10482", mode: "live" });
      expect(items[1]).toMatchObject({ attempts: 2, nextRetryAt: "2026-11-14T16:10:00.000Z" });
      expect(items[2]).toMatchObject({ attempts: 5, error: "Zoho refused: INVALID_DATA" });
      expect(items[4]).toMatchObject({ notApplicableReason: "not_paid" });
      expect(items[5]).toMatchObject({ notApplicableReason: "not_sent_yet" });
    });

    it("follows an order through a failure and its replay", async () => {
      const order = randomUUID();
      await delivery(order, "dead_lettered", { error: "Zoho refused" });
      expect(await stateOf(order)).toBe("failed");

      await delivery(order, "pending");
      expect(await stateOf(order)).toBe("failed");

      await delivery(order, "succeeded");
      expect(await stateOf(order)).toBe("mirrored");

      await delivery(order, "processing");
      expect(await stateOf(order)).toBe("pending");
    });

    it("does not change the ledger by reading it", async () => {
      const order = randomUUID();
      await delivery(order, "retryable");
      await mirror.status("order", order);
      const result = await db.execute(sql`SELECT status, attempts FROM domain_event_delivery`);
      const rows = (
        Array.isArray(result) ? result : (result as { rows: unknown[] }).rows
      ) as unknown[];
      expect(rows).toEqual([{ status: "retryable", attempts: 1 }]);
    });
  },
);
