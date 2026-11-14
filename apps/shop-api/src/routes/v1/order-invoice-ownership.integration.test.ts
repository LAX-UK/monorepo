import { randomUUID } from "node:crypto";
import type pg from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

/** Each token is one shopper: the subject the route filters the order by. */
vi.mock("@auction/auth/token-verifier", () => ({
  verifyBearerToken: vi.fn(async (options: { authorization?: string | null }) => ({
    subject: (options.authorization ?? "").replace(/^Bearer /, ""),
    payload: { scope: "shop.read" },
  })),
}));
import { createShopApiApp } from "../../app.js";
import { createGetOrderHandler } from "../../application/handlers/commerce-handlers.js";
import { createOrderInvoiceCardService } from "../../application/order-invoice-card.js";
import { createDrizzleOrderInvoiceBooksReader } from "../../infrastructure/drizzle-order-invoice-books.reader.js";
import { createDrizzleOrderRepository } from "../../infrastructure/drizzle-order.repository.js";
import { createMinimalShopApiTestDeps } from "../../test-app-deps.js";
import {
  createShopDb,
  hasShopIntegrationDb,
  setupShopIntegrationPools,
} from "../../test-support/shop-integration-setup.js";

/**
 * The buyer's Books invoice routes through the real order repository, as shop_app: the order is
 * loaded by the shopper (`getOrder(subject, orderId)`), so another shopper's order is the same 404
 * on the card and on the download, and Books' records and the stored copy are never read for it.
 */
describe.skipIf(!hasShopIntegrationDb)("Shop invoice routes: only the shopper's own order", () => {
  let ownerPool!: pg.Pool;
  let shopPool!: pg.Pool;
  const owner = `shop-invoice-owner-${randomUUID().slice(0, 8)}`;
  const stranger = `shop-invoice-stranger-${randomUUID().slice(0, 8)}`;
  let orderId = "";
  let documentId = "";

  beforeAll(async () => {
    ({ ownerPool, shopPool } = await setupShopIntegrationPools());
    const order = await ownerPool.query<{ id: string }>(
      `insert into shop_order
         (identity_subject_id, fulfilment, merchandise_subtotal_pence, fulfilment_surcharge_pence,
          total_pence, idempotency_key, status, paid_at)
       values ($1, 'uk_insured_delivery', 45000, 2500, 47500, $2, 'paid', now())
       returning id`,
      [owner, `invoice-ownership-${randomUUID()}`],
    );
    orderId = order.rows[0]?.id as string;
    documentId = randomUUID();
    await ownerPool.query(
      `insert into accounting_document
         (id, product, legal_entity, kind, lax_reference, source_event_ref, payload,
          net_pence, vat_pence, gross_pence, target_provider, target_mode, provider, state,
          attempts, provider_id, provider_number)
       values ($1, 'shop', 'london_art_exchange', 'invoice', $2, 'domain_event:1', '{}'::jsonb,
               47500, 0, 47500, 'books', 'live', 'books', 'issued', 1, '7000000000002', 'LAX-INV-000999')`,
      [documentId, `LAX-SHOP-INV-${orderId}`],
    );
  });

  afterAll(async () => {
    await Promise.allSettled([ownerPool.end(), shopPool.end()]);
  });

  function app() {
    const db = createShopDb(shopPool);
    const reader = createDrizzleOrderInvoiceBooksReader(db);
    const booksRead = vi.fn((id: string) => reader.read(id));
    const getObjectBytes = vi.fn(async () => Buffer.from("%PDF-1.4 stored"));
    const base = createMinimalShopApiTestDeps();
    const deps = createMinimalShopApiTestDeps({
      commerce: {
        ...base.commerce,
        getOrder: createGetOrderHandler(createDrizzleOrderRepository(db)),
        orderInvoiceCard: createOrderInvoiceCardService({
          books: { read: booksRead },
          storage: { getObjectBytes },
          now: () => new Date(),
        }),
      },
    });
    return { app: createShopApiApp({ deps, logger: false }), booksRead, getObjectBytes };
  }

  it("another shopper's order is the same 404 on the card and the download; Books is never read", async () => {
    const { app: server, booksRead, getObjectBytes } = app();
    await server.ready();
    const urls = [
      `/v1/orders/${orderId}/invoice-card`,
      `/v1/orders/${orderId}/invoice-documents/${documentId}`,
    ];
    const missing = randomUUID();
    const bodies: string[] = [];
    for (const url of [...urls, `/v1/orders/${missing}/invoice-card`]) {
      const response = await server.inject({
        method: "GET",
        url,
        headers: { authorization: `Bearer ${stranger}` },
      });
      expect(response.statusCode, url).toBe(404);
      expect(response.headers["cache-control"], url).toBe("private, no-store");
      bodies.push(response.json().code);
    }
    // Someone else's order says exactly what a missing one says.
    expect(bodies[0]).toBe(bodies[2]);
    expect(booksRead).not.toHaveBeenCalled();
    expect(getObjectBytes).not.toHaveBeenCalled();
    await server.close();
  });

  it("the shopper's own order is found, and only then are its Books records read", async () => {
    const { app: server, booksRead } = app();
    await server.ready();
    const response = await server.inject({
      method: "GET",
      url: `/v1/orders/${orderId}/invoice-card`,
      headers: { authorization: `Bearer ${owner}` },
    });
    expect(response.statusCode).toBe(200);
    expect(booksRead).toHaveBeenCalledWith(orderId);
    await server.close();
  });
});
