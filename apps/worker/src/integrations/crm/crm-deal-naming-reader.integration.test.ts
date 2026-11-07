import { randomUUID } from "node:crypto";
import { createDb } from "@auction/db";
import { applyApplicationRoleGrants } from "@auction/db/migrate-roles";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDrizzleCrmDealNamingReader } from "./crm-deal-naming-reader.js";

const ownerUrl = process.env.MIGRATION_TEST_DATABASE_URL;
const workerUrl = process.env.DATABASE_URL_WORKER;

/**
 * Runs the Shop order Deal naming as `worker_app`, the role the CRM projector connects with.
 * The Shop tables it reads are denied to that role as a whole, so this fails if the column
 * grants are missing.
 */
describe.skipIf(!ownerUrl || !workerUrl)("CRM deal naming reader as worker_app", () => {
  const tag = randomUUID().slice(0, 8);
  const orderId = randomUUID();
  const guestId = randomUUID();
  const subjectId = `guest:${tag}`;
  const reference = `LAX-S-TEST-${tag}`;
  let owner: pg.Pool;

  beforeAll(async () => {
    if (!ownerUrl) throw new Error("MIGRATION_TEST_DATABASE_URL is required");
    owner = new pg.Pool({ connectionString: ownerUrl });
    await applyApplicationRoleGrants(ownerUrl);
    await owner.query("insert into shop_guest_customer (id, email, name) values ($1, $2, $3)", [
      guestId,
      `guest.${tag}@integration.test`,
      "Gail Guest",
    ]);
    await owner.query(
      `insert into shop_order (id, reference, identity_subject_id, guest_customer_id, fulfilment,
         merchandise_subtotal_pence, fulfilment_surcharge_pence, total_pence, idempotency_key)
       values ($1, $2, $3, $4, 'collect_new_cavendish', 1000, 0, 1000, $5)`,
      [orderId, reference, subjectId, guestId, `deal-naming:${tag}`],
    );
    await owner.query(
      "insert into shop_order_line (order_id, unit_price_pence) values ($1, 1000)",
      [orderId],
    );
  });

  afterAll(async () => {
    if (!owner) return;
    await owner.query("delete from shop_order_line where order_id = $1", [orderId]);
    await owner.query("delete from shop_order where id = $1", [orderId]);
    await owner.query("delete from shop_guest_customer where id = $1", [guestId]);
    await owner.end();
  });

  it("names a guest order from the order, its lines and the guest", async () => {
    // biome-ignore lint/style/noNonNullAssertion: gated by skipIf
    const reader = createDrizzleCrmDealNamingReader(createDb(workerUrl!));
    expect(await reader.forShopOrder({ orderId, subjectId, lineCount: 3 })).toEqual({
      clientName: "Gail Guest",
      stockCode: null,
      artworkKind: null,
      additionalWorks: 2,
      reference,
    });
  });
});
