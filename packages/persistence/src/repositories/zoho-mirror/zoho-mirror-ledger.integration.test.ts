import { randomUUID } from "node:crypto";
import { type Database, closeDb, createDb } from "@auction/db";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { DrizzleZohoMirrorLedgerReader } from "./drizzle-zoho-mirror-ledger.reader.js";

const url = process.env.DATABASE_URL;

// Private copies of the two ledger tables in a schema of its own (first on the search path), so
// nothing here touches, or is touched by, rows other integration files keep in the public ones.
const SCHEMA = `zoho_mirror_${randomUUID().replaceAll("-", "").slice(0, 12)}`;
const TABLES = ["domain_events", "domain_event_delivery"];
let db: Database = null as never;

const ORDER_A = randomUUID();
const ORDER_B = randomUUID();
const REGISTER = randomUUID();

async function event(input: {
  type: string;
  aggregateType: string;
  aggregateId: string;
  payload: Record<string, unknown>;
}): Promise<number> {
  const result = await db.execute(sql`
    INSERT INTO domain_events (aggregate_type, aggregate_id, event_type, payload, producer)
    VALUES (${input.aggregateType}, ${input.aggregateId}, ${input.type},
      ${JSON.stringify(input.payload)}::jsonb, 'test')
    RETURNING id
  `);
  const rows = (Array.isArray(result) ? result : (result as { rows: unknown[] }).rows) as {
    id: number | string;
  }[];
  return Number(rows[0]?.id);
}

async function deliver(
  eventId: number,
  consumer: string,
  status: string,
  extra: { error?: string; reference?: string; attempts?: number } = {},
) {
  await db.execute(sql`
    INSERT INTO domain_event_delivery (consumer, event_id, status, attempts, provider_reference, last_error)
    VALUES (${consumer}, ${eventId}, ${status}, ${extra.attempts ?? 1},
      ${extra.reference ?? null}, ${extra.error ?? null})
  `);
}

const orderEvent = (type: string, orderId: string, aggregateType = "shop_order_line") =>
  event({ type, aggregateType, aggregateId: randomUUID(), payload: { schemaVersion: 1, orderId } });

describe.skipIf(!url)("DrizzleZohoMirrorLedgerReader (Postgres)", { timeout: 30_000 }, () => {
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

  it("gathers an order's deliveries across the events raised on its lines and fulfilment, oldest first", async () => {
    const paid = await orderEvent("shop.order.paid", ORDER_A, "shop_order");
    const packed = await orderEvent("shop.print.pack_confirmed", ORDER_A);
    const dispatched = await orderEvent("shop.fulfilment.dispatched", ORDER_A, "shop_fulfilment");
    await deliver(dispatched, "zoho_fulfilment", "pending");
    await deliver(paid, "zoho_fulfilment", "succeeded", { reference: "Order:LAX-S-1" });
    await deliver(packed, "zoho_fulfilment", "skipped", { error: "order_already_in_sync" });

    const { consumer, deliveries } = await new DrizzleZohoMirrorLedgerReader(db).read("order", [
      ORDER_A,
    ]);

    expect(consumer).toBe("zoho_fulfilment");
    expect(deliveries.get(ORDER_A)?.map((row) => [row.eventId, row.status])).toEqual([
      [paid, "succeeded"],
      [packed, "skipped"],
      [dispatched, "pending"],
    ]);
    expect(deliveries.get(ORDER_A)?.[0]).toMatchObject({
      providerReference: "Order:LAX-S-1",
      attempts: 1,
    });
    expect(deliveries.get(ORDER_A)?.[1]?.lastError).toBe("order_already_in_sync");
  });

  it("keeps each asked-for record's deliveries apart, and answers an empty list for one with none", async () => {
    await deliver(
      await orderEvent("shop.order.paid", ORDER_A, "shop_order"),
      "zoho_fulfilment",
      "succeeded",
    );
    const unknown = randomUUID();
    const { deliveries } = await new DrizzleZohoMirrorLedgerReader(db).read("order", [
      ORDER_A,
      ORDER_B,
      unknown,
    ]);
    expect(deliveries.get(ORDER_A)).toHaveLength(1);
    expect(deliveries.get(ORDER_B)).toEqual([]);
    expect(deliveries.get(unknown)).toEqual([]);
  });

  it("ignores other consumers' deliveries of the same events", async () => {
    const paid = await orderEvent("shop.order.paid", ORDER_A, "shop_order");
    await deliver(paid, "zoho", "dead_lettered", { error: "crm failed" });
    await deliver(paid, "zoho_fulfilment", "succeeded");
    const { deliveries } = await new DrizzleZohoMirrorLedgerReader(db).read("order", [ORDER_A]);
    expect(deliveries.get(ORDER_A)?.map((row) => row.status)).toEqual(["succeeded"]);
  });

  it("reads an artwork from its register events and the write-back consumer only", async () => {
    const moved = await event({
      type: "artwork_register.offer_changed",
      aggregateType: "artwork_register",
      aggregateId: REGISTER,
      payload: { registerId: REGISTER },
    });
    await deliver(moved, "zoho_artwork_writeback", "dead_lettered", {
      error: "Zoho refused",
      attempts: 5,
    });
    await deliver(moved, "zoho_artwork_listing", "succeeded");
    // Same id on a different aggregate type is not this artwork.
    const stranger = await event({
      type: "shop.artwork.updated",
      aggregateType: "shop_artwork",
      aggregateId: REGISTER,
      payload: {},
    });
    await deliver(stranger, "zoho_artwork_writeback", "succeeded");

    const { consumer, deliveries } = await new DrizzleZohoMirrorLedgerReader(db).read("artwork", [
      REGISTER,
    ]);
    expect(consumer).toBe("zoho_artwork_writeback");
    expect(deliveries.get(REGISTER)).toMatchObject([
      { status: "dead_lettered", attempts: 5, lastError: "Zoho refused" },
    ]);
  });

  it("names each delivery's event type, and reads only the events the order mirror handles", async () => {
    const paid = await orderEvent("shop.order.paid", ORDER_A, "shop_order");
    await deliver(paid, "zoho_fulfilment", "dead_lettered", { error: "print_order_not_mirrored" });
    // An event the fulfilment mirror does not hear, even with the order's id and a delivery row.
    const other = await orderEvent("shop.order.checkout_started", ORDER_A, "shop_order");
    await deliver(other, "zoho_fulfilment", "succeeded");

    const { deliveries } = await new DrizzleZohoMirrorLedgerReader(db).read("order", [ORDER_A]);
    expect(deliveries.get(ORDER_A)?.map((row) => [row.eventType, row.status])).toEqual([
      ["shop.order.paid", "dead_lettered"],
    ]);
  });

  it("reads only the register events the write-back sends for an artwork", async () => {
    const code = await event({
      type: "artwork_register.stock_code_assigned",
      aggregateType: "artwork_register",
      aggregateId: REGISTER,
      payload: { registerId: REGISTER },
    });
    await deliver(code, "zoho_artwork_writeback", "succeeded");
    const other = await event({
      type: "artwork_register.entry_created",
      aggregateType: "artwork_register",
      aggregateId: REGISTER,
      payload: { registerId: REGISTER },
    });
    await deliver(other, "zoho_artwork_writeback", "skipped", { error: "event_type_not_handled" });

    const { deliveries } = await new DrizzleZohoMirrorLedgerReader(db).read("artwork", [REGISTER]);
    expect(deliveries.get(REGISTER)?.map((row) => [row.eventType, row.status])).toEqual([
      ["artwork_register.stock_code_assigned", "succeeded"],
    ]);
  });

  it("answers an empty batch without reading", async () => {
    const { deliveries } = await new DrizzleZohoMirrorLedgerReader(db).read("order", []);
    expect(deliveries.size).toBe(0);
  });
});
