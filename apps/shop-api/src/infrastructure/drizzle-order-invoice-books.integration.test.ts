import { randomUUID } from "node:crypto";
import { booksTargetMode } from "@auction/accounting-domain";
import { sql } from "drizzle-orm";
import type pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createShopDb,
  hasShopIntegrationDb,
  setupShopIntegrationPools,
} from "../test-support/shop-integration-setup.js";
import { createDrizzleOrderInvoiceBooksReader } from "./drizzle-order-invoice-books.reader.js";

const ISSUED_AT = new Date("2031-11-12T14:07:00.000Z");

describe.skipIf(!hasShopIntegrationDb)("a Shop order's Books invoice, read as shop_app", () => {
  let ownerPool!: pg.Pool;
  let shopPool!: pg.Pool;

  beforeAll(async () => {
    ({ ownerPool, shopPool } = await setupShopIntegrationPools());
  });

  afterAll(async () => {
    await Promise.allSettled([ownerPool.end(), shopPool.end()]);
  });

  /** An issued live Shop invoice with LAX's copy and its issue event, written as the owner. */
  async function seedIssued(orderId: string) {
    const documentId = randomUUID();
    await ownerPool.query(
      `insert into accounting_document
         (id, product, legal_entity, kind, lax_reference, source_event_ref, payload,
          net_pence, vat_pence, gross_pence, target_provider, target_mode, provider, state,
          attempts, provider_id, provider_number)
       values ($1, 'shop', 'london_art_exchange', 'invoice', $2, 'domain_event:1',
               '{"lines":[{"description":"Ada Collector private note"}]}'::jsonb,
               59500, 0, 59500, 'books', 'live', 'books', 'issued', 1, '7000000000001', 'LAX-INV-000124')`,
      [documentId, `LAX-SHOP-INV-${orderId}`],
    );
    await ownerPool.query(
      `insert into accounting_document_copy (document_id, storage_key, byte_size, sha256, rehearsal, stored_at)
       values ($1, $2, 10, $3, false, now())`,
      [documentId, `accounting/london_art_exchange/${documentId}.pdf`, "a".repeat(64)],
    );
    await ownerPool.query(
      `insert into accounting_document_event (document_id, action, from_state, to_state, attempts, detail, occurred_at)
       values ($1, 'complete_sending', 'sending', 'issued', 1, '{}'::jsonb, $2)`,
      [documentId, ISSUED_AT],
    );
    return documentId;
  }

  it("reads the state, number, copy and issue time with its column grants, and nothing else", async () => {
    const orderId = randomUUID();
    const documentId = await seedIssued(orderId);
    const reader = createDrizzleOrderInvoiceBooksReader(createShopDb(shopPool));
    const read = await reader.read(orderId);
    const setting = await ownerPool.query<{ xero_mode: string; books_mode: string }>(
      "select xero_mode, books_mode from accounting_source_setting where product = 'shop'",
    );
    const row = setting.rows[0];
    expect(read.booksMode).toBe(
      row ? booksTargetMode({ xero: row.xero_mode, books: row.books_mode } as never) : null,
    );
    expect(read.documents).toEqual([
      {
        documentId,
        targetMode: "live",
        state: "issued",
        providerNumber: "LAX-INV-000124",
        issuedAt: ISSUED_AT,
        copy: { storageKey: `accounting/london_art_exchange/${documentId}.pdf`, rehearsal: false },
      },
    ]);
    // Another order's invoice is never read for this one.
    expect((await reader.read(randomUUID())).documents).toEqual([]);
  });

  it("cannot read a document's payload or totals, or change anything", async () => {
    const orderId = randomUUID();
    const documentId = await seedIssued(orderId);
    const db = createShopDb(shopPool);
    const code = (p: Promise<unknown>) =>
      p
        .then(() => "allowed")
        .catch((e: { cause?: { code?: string }; code?: string }) => e.cause?.code ?? e.code);
    expect(
      await code(db.execute(sql`select payload from accounting_document where id = ${documentId}`)),
    ).toBe("42501");
    expect(
      await code(
        db.execute(sql`select gross_pence from accounting_document where id = ${documentId}`),
      ),
    ).toBe("42501");
    expect(
      await code(
        db.execute(
          sql`update accounting_document set state = 'cancelled' where id = ${documentId}`,
        ),
      ),
    ).toBe("42501");
    expect(
      await code(
        db.execute(sql`delete from accounting_document_copy where document_id = ${documentId}`),
      ),
    ).toBe("42501");
  });
});
