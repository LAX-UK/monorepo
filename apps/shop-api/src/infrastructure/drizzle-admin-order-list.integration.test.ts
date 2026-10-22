import type pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AdminOrderListInput } from "../application/ports/admin-readers.js";
import { integrationSuffix } from "../test-support/shop-fixtures.js";
import {
  createShopDb,
  hasShopIntegrationDb,
  setupShopIntegrationPools,
} from "../test-support/shop-integration-setup.js";
import { createDrizzleAdminReadRepository } from "./drizzle-admin-read.repository.js";

describe.skipIf(!hasShopIntegrationDb)("drizzle admin order list", () => {
  let shopPool: pg.Pool;
  let ownerPool: pg.Pool;

  beforeAll(async () => {
    ({ ownerPool, shopPool } = await setupShopIntegrationPools());
  });

  afterAll(async () => {
    await shopPool.end();
    await ownerPool.end();
  });

  function setup() {
    const repo = createDrizzleAdminReadRepository(createShopDb(shopPool));
    /** Part of every buyer email in one test, so searching for it isolates that test's orders. */
    const marker = integrationSuffix("ord").replace(/_/g, "-");
    return { repo, marker };
  }

  type SeedOrder = {
    createdAt: string;
    status?: string;
    buyerName?: string;
    /** Local part of the buyer's email; the marker is the domain. */
    buyer?: string;
    recipient?: string;
  };

  async function seedOrders(marker: string, orders: SeedOrder[]): Promise<string[]> {
    const ids: string[] = [];
    for (const [index, order] of orders.entries()) {
      const subject = `${marker}-buyer-${order.buyer ?? index}`;
      await ownerPool.query(
        `insert into shop_user_profile (identity_subject_id, email, name)
         values ($1, $2, $3) on conflict (identity_subject_id) do nothing`,
        [subject, `${order.buyer ?? `buyer${index}`}@${marker}.test`, order.buyerName ?? null],
      );
      const { rows } = await ownerPool.query<{ id: string }>(
        `insert into shop_order
           (identity_subject_id, status, fulfilment, merchandise_subtotal_pence,
            fulfilment_surcharge_pence, total_pence, idempotency_key, delivery_recipient_name,
            created_at, updated_at)
         values ($1, $2::shop_order_status, 'collect_brunswick', 1000, 0, 1000, $3, $4,
                 $5::timestamptz, $5::timestamptz)
         returning id`,
        [
          subject,
          order.status ?? "paid",
          `${marker}-${index}`,
          order.recipient ?? null,
          order.createdAt,
        ],
      );
      ids.push(rows[0]?.id ?? "");
    }
    return ids;
  }

  async function allPages(
    repo: ReturnType<typeof createDrizzleAdminReadRepository>,
    filters: AdminOrderListInput,
    limit: number,
  ) {
    const pages: string[][] = [];
    let cursor: string | null | undefined;
    do {
      const page = await repo.orders.listOrders({
        ...filters,
        limit,
        ...(cursor ? { cursor } : {}),
      });
      pages.push(page.items.map((item) => item.orderId));
      cursor = page.nextCursor;
    } while (cursor);
    return pages;
  }

  it("pages through orders created in the same millisecond without repeating or skipping any", async () => {
    const { repo, marker } = setup();
    const same = "2026-03-01T10:00:00.123Z";
    const ids = await seedOrders(marker, [
      { createdAt: same },
      { createdAt: same },
      { createdAt: same },
      { createdAt: same },
      { createdAt: same },
      { createdAt: "2026-03-01T09:00:00.000Z" },
    ]);

    const pages = await allPages(repo, { q: marker }, 2);

    expect(pages.map((page) => page.length)).toEqual([2, 2, 2]);
    const flat = pages.flat();
    expect([...flat].sort()).toEqual([...ids].sort());
    expect(flat.slice(0, 5)).toEqual([...flat.slice(0, 5)].sort().reverse());
    expect(flat[5]).toBe(ids[5]);
  });

  it("keeps paging correctly under a status and date filter", async () => {
    const { repo, marker } = setup();
    const same = "2026-03-02T12:00:00.000Z";
    await seedOrders(marker, [
      { createdAt: same, status: "paid" },
      { createdAt: same, status: "cancelled" },
      { createdAt: same, status: "paid" },
      { createdAt: same, status: "paid" },
      { createdAt: "2026-04-02T12:00:00.000Z", status: "paid" },
    ]);
    const pages = await allPages(
      repo,
      { q: marker, status: "paid", createdFrom: "2026-03-01", createdTo: "2026-03-31" },
      2,
    );
    expect(pages.map((page) => page.length)).toEqual([2, 1]);
  });

  it("filters by status and counts every status under the other filters", async () => {
    const { repo, marker } = setup();
    const createdAt = "2026-03-03T12:00:00.000Z";
    const [paid] = await seedOrders(marker, [
      { createdAt, status: "paid" },
      { createdAt, status: "pending_payment" },
      { createdAt, status: "pending_payment" },
      { createdAt, status: "refunded" },
    ]);

    const page = await repo.orders.listOrders({ q: marker, status: "paid" });

    expect(page.items.map((item) => item.orderId)).toEqual([paid]);
    expect(page.counts).toEqual({ paid: 1, pending_payment: 2, refunded: 1 });
  });

  it("includes both end days of a date range, counted as UK days", async () => {
    const { repo, marker } = setup();
    // 23:30 UTC on 31 March is 00:30 on 1 April in the UK (BST), so it belongs to April.
    const [lateMarch, earlyApril, endOfApril, midnightMay] = await seedOrders(marker, [
      { createdAt: "2026-03-31T22:30:00.000Z" },
      { createdAt: "2026-03-31T23:30:00.000Z" },
      { createdAt: "2026-04-30T22:59:59.000Z" },
      { createdAt: "2026-04-30T23:00:00.000Z" },
    ]);

    const april = await repo.orders.listOrders({
      q: marker,
      createdFrom: "2026-04-01",
      createdTo: "2026-04-30",
    });
    expect(april.items.map((item) => item.orderId).sort()).toEqual([earlyApril, endOfApril].sort());

    const from = await repo.orders.listOrders({ q: marker, createdFrom: "2026-04-01" });
    expect(from.items).toHaveLength(3);
    const to = await repo.orders.listOrders({ q: marker, createdTo: "2026-03-31" });
    expect(to.items.map((item) => item.orderId)).toEqual([lateMarch]);
    expect(midnightMay).toBeDefined();
  });

  describe("search", () => {
    it("matches buyer email, buyer name and delivery recipient, in any case", async () => {
      const { repo, marker } = setup();
      const createdAt = "2026-03-04T12:00:00.000Z";
      const [byEmail, byName, byRecipient] = await seedOrders(marker, [
        { createdAt, buyer: "zelda" },
        { createdAt, buyer: "other1", buyerName: "Quentin Quill" },
        { createdAt, buyer: "other2", recipient: "Rosalind Reed" },
      ]);

      const find = async (q: string) =>
        (await repo.orders.listOrders({ q })).items.map((item) => item.orderId);
      expect(await find(`ZELDA@${marker}`)).toEqual([byEmail]);
      expect(await find("quentin quill")).toEqual([byName]);
      expect(await find("rosalind")).toEqual([byRecipient]);
      expect((await repo.orders.listOrders({ q: marker })).items).toHaveLength(3);
    });

    it("returns the buyer's name and email with each order", async () => {
      const { repo, marker } = setup();
      await seedOrders(marker, [
        { createdAt: "2026-03-05T12:00:00.000Z", buyer: "ada", buyerName: "Ada Lovelace" },
      ]);
      const page = await repo.orders.listOrders({ q: marker });
      expect(page.items[0]).toMatchObject({
        buyerName: "Ada Lovelace",
        buyerEmail: `ada@${marker}.test`,
      });
    });

    it("finds an order by the start of its id, with or without a leading #", async () => {
      const { repo, marker } = setup();
      const [id = ""] = await seedOrders(marker, [{ createdAt: "2026-03-06T12:00:00.000Z" }]);
      for (const q of [id.slice(0, 8), `#${id.slice(0, 8).toUpperCase()}`, id]) {
        const page = await repo.orders.listOrders({ q });
        expect(
          page.items.map((item) => item.orderId),
          q,
        ).toEqual([id]);
      }
      // The middle of an id is not an order number.
      const middle = await repo.orders.listOrders({ q: id.slice(10, 18) });
      expect(middle.items.map((item) => item.orderId)).not.toContain(id);
    });

    it("treats LIKE wildcards as ordinary characters", async () => {
      const { repo, marker } = setup();
      const createdAt = "2026-03-07T12:00:00.000Z";
      const [literal] = await seedOrders(marker, [
        { createdAt, buyer: "plain" },
        { createdAt, buyer: "fifty%off", buyerName: "Fifty%Off" },
      ]);
      const percent = await repo.orders.listOrders({ q: `fifty%off@${marker}` });
      expect(percent.items).toHaveLength(1);
      // Unescaped, "%" would match everything and "_" any single character.
      expect((await repo.orders.listOrders({ q: `%@${marker}` })).items).toHaveLength(0);
      expect((await repo.orders.listOrders({ q: `pl_in@${marker}` })).items).toHaveLength(0);
      expect((await repo.orders.listOrders({ q: "\\" })).items.map((i) => i.orderId)).not.toContain(
        literal,
      );
    });
  });
});
