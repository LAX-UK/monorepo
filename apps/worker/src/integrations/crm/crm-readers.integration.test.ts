import { randomUUID } from "node:crypto";
import { createDb } from "@auction/db";
import { applyApplicationRoleGrants } from "@auction/db/migrate-roles";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createDrizzleCrmDealSourceReader,
  createDrizzleCrmShopRefundReader,
} from "./crm-readers.js";

const ownerUrl = process.env.MIGRATION_TEST_DATABASE_URL;
const workerUrl = process.env.DATABASE_URL_WORKER;

/**
 * The Shop refund and deal source readers as `worker_app`, the role the CRM projector connects
 * with: this fails if the column grants they rely on are missing.
 */
describe.skipIf(!ownerUrl || !workerUrl)("CRM refund and deal source readers as worker_app", () => {
  const tag = randomUUID().slice(0, 8);
  const orderId = randomUUID();
  const partialId = randomUUID();
  const failedId = randomUUID();
  const eventIds: number[] = [];
  let owner: pg.Pool;

  beforeAll(async () => {
    if (!ownerUrl) throw new Error("MIGRATION_TEST_DATABASE_URL is required");
    owner = new pg.Pool({ connectionString: ownerUrl });
    await applyApplicationRoleGrants(ownerUrl);
    await owner.query(
      `insert into shop_order (id, reference, identity_subject_id, fulfilment,
         merchandise_subtotal_pence, fulfilment_surcharge_pence, total_pence, idempotency_key)
       values ($1, $2, $3, 'collect_new_cavendish', 200000, 0, 200000, $4)`,
      [orderId, `LAX-S-TEST-${tag}`, `sub-${tag}`, `crm-readers:${tag}`],
    );
    const refund = (id: string, amount: number, status: string) =>
      owner.query(
        `insert into shop_refund (id, order_id, amount_pence, status, idempotency_key,
           requested_by_subject_id)
         values ($1, $2, $3, $4, $5, 'staff')`,
        [id, orderId, amount, status, `crm-readers:${id}`],
      );
    await refund(partialId, 500, "succeeded");
    await refund(randomUUID(), 1500, "succeeded");
    await refund(failedId, 9000, "failed");
  });

  afterAll(async () => {
    if (!owner) return;
    await owner.query("delete from domain_events where id = any($1::bigint[])", [eventIds]);
    await owner.query("delete from shop_refund where order_id = $1", [orderId]);
    await owner.query("delete from shop_order where id = $1", [orderId]);
    await owner.end();
  });

  async function paidEvent(status: string | null): Promise<void> {
    const { rows } = await owner.query<{ id: string }>(
      `insert into domain_events (aggregate_type, aggregate_id, event_type, payload, producer)
       values ('shop_order', $1, 'shop.order.paid', '{}'::jsonb, 'shop-api') returning id`,
      [orderId],
    );
    const eventId = Number(rows[0]?.id);
    eventIds.push(eventId);
    if (status) {
      await owner.query(
        "insert into domain_event_delivery (consumer, event_id, status) values ('zoho', $1, $2)",
        [eventId, status],
      );
    }
  }

  it("reads a refund with the order's succeeded refunds and total", async () => {
    // biome-ignore lint/style/noNonNullAssertion: gated by skipIf
    const reader = createDrizzleCrmShopRefundReader(createDb(workerUrl!));
    expect(await reader.findById(partialId)).toEqual({
      amountPence: 500,
      refundedTotalPence: 2000,
      orderTotalPence: 200000,
    });
    expect(await reader.findById(randomUUID())).toBeNull();
  });

  it("says whether the CRM delivery of the order's paid event is still to run", async () => {
    // biome-ignore lint/style/noNonNullAssertion: gated by skipIf
    const reader = createDrizzleCrmDealSourceReader(createDb(workerUrl!));
    const source = {
      aggregateType: "shop_order",
      aggregateId: orderId,
      eventType: "shop.order.paid",
    };

    expect(await reader.isDeliveryInFlight(source)).toBe(false);
    await paidEvent(null);
    expect(await reader.isDeliveryInFlight(source)).toBe(false);
    await paidEvent("skipped");
    expect(await reader.isDeliveryInFlight(source)).toBe(false);
    await paidEvent("retryable");
    expect(await reader.isDeliveryInFlight(source)).toBe(true);
  });
});
