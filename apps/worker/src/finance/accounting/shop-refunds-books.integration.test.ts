import { randomUUID } from "node:crypto";
import {
  type CreditNote,
  type DestinationBinding,
  projectShopRefundSettled,
} from "@auction/accounting-domain";
import { InMemoryAccounting, SHOP_ORG_ID } from "@auction/accounting-zoho-books/testing";
import { type Database, closeDb, createDb } from "@auction/db";
import { accountingDocument, accountingDocumentEvent, domainEvent } from "@auction/db/schema";
import {
  DrizzleShopAccountingFactsReader,
  createAccountingRepositories,
} from "@auction/persistence/repositories";
import { and, eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { holdAccountingTablesLock } from "../../testing/accounting-tables-lock.js";
import { AccountingCreditNoteRefund } from "./accounting-credit-note-refund.service.js";
import { AccountingProjection } from "./accounting-projection.service.js";
import { AccountingSender } from "./accounting-sender.service.js";

const OWNER_URL = process.env.DATABASE_URL;
const WORKER_URL = process.env.DATABASE_URL_WORKER;
const HAS_DB = Boolean(OWNER_URL);

const PAID_AT = new Date("2031-11-12T14:05:00Z");
const REFUNDED_AT = new Date("2031-11-13T10:00:00Z");
const log = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
const bound: DestinationBinding = { test_org: { shop: SHOP_ORG_ID } };

const PRINT_PENCE = 45_000;
const SECOND_PENCE = 12_000;
const DELIVERY_PENCE = 2_500;
const TOTAL = PRINT_PENCE + SECOND_PENCE + DELIVERY_PENCE;

/**
 * A paid Shop order as the Shop leaves it: two prints and UK delivery, the invoice number from the
 * database's counter, and the references-only event. Fixture data only.
 */
async function seedPaidOrder(db: Database) {
  const tag = randomUUID().slice(0, 8);
  const subject = `shop-refund-${tag}`;
  const party = await db.execute<{ id: string }>(
    sql`insert into shop_party (display_name, kind) values (${`Buyer ${tag}`}, 'person') returning id`,
  );
  const partyId = party.rows[0]?.id as string;
  await db.execute(
    sql`insert into shop_user_profile (identity_subject_id, email, name)
        values (${subject}, ${`${subject}@integration.test`}, ${`Ada ${tag}`})`,
  );
  const variants: string[] = [];
  for (const [n, price] of [
    [1, PRINT_PENCE],
    [2, SECOND_PENCE],
  ] as const) {
    const product = await db.execute<{ id: string }>(
      sql`insert into shop_product (slug, title) values (${`print-${tag}-${n}`}, ${`Print ${n} ${tag}`}) returning id`,
    );
    const variant = await db.execute<{ id: string }>(
      sql`insert into shop_product_variant (product_id, sku, price_pence)
          values (${product.rows[0]?.id}, ${`SKU-${tag}-${n}`}, ${price}) returning id`,
    );
    variants.push(variant.rows[0]?.id as string);
  }
  const order = await db.execute<{ id: string }>(
    sql`insert into shop_order
          (identity_subject_id, fulfilment, merchandise_subtotal_pence, framing_subtotal_pence,
           fulfilment_surcharge_pence, fulfilment_vat_pence, total_pence, idempotency_key, buyer_party_id)
        values (${subject}, 'uk_insured_delivery', ${PRINT_PENCE + SECOND_PENCE}, 0,
                ${DELIVERY_PENCE}, null, ${TOTAL}, ${`refund-${tag}`}, ${partyId})
        returning id`,
  );
  const orderId = order.rows[0]?.id as string;
  const stored: { id: string; pence: number }[] = [];
  for (const [i, pence] of [PRINT_PENCE, SECOND_PENCE].entries()) {
    const line = await db.execute<{ id: string }>(
      sql`insert into shop_order_line (order_id, product_variant_id, unit_price_pence)
          values (${orderId}, ${variants[i]}, ${pence}) returning id`,
    );
    stored.push({ id: line.rows[0]?.id as string, pence });
  }
  await db.execute(
    sql`update shop_order set status = 'paid', paid_at = ${PAID_AT.toISOString()}::timestamptz where id = ${orderId}`,
  );
  // The invoice lines follow the stored lines' order (by id): the first and second as invoiced.
  const lines = stored.sort((a, b) => (a.id < b.id ? -1 : 1));
  const sorted = lines.map((line) => line.id);
  const [event] = await db
    .insert(domainEvent)
    .values({
      aggregateType: "shop_order",
      aggregateId: orderId,
      eventType: "shop.accounting.order_paid",
      payload: { schemaVersion: 1, orderId, lineIds: sorted, paidAt: PAID_AT.toISOString() },
      schemaVersion: 1,
      producer: "shop-api",
    })
    .returning();
  return { orderId, lines, event: event as NonNullable<typeof event> };
}

holdAccountingTablesLock({ beforeAll, afterAll });

describe.skipIf(!HAS_DB)("Shop refunds to Books (integration)", { timeout: 60_000 }, () => {
  // biome-ignore lint/style/noNonNullAssertion: gated by HAS_DB
  const owner = createDb(OWNER_URL!);
  const worker = createDb(WORKER_URL || (OWNER_URL as string));
  const repos = createAccountingRepositories(worker, { now: () => new Date() });
  const shopFacts = new DrizzleShopAccountingFactsReader(worker);

  afterAll(async () => {
    await owner.execute(sql`
      update accounting_source_setting
         set xero_mode = case product when 'bid' then 'live' else 'off' end, books_mode = 'off'`);
    await closeDb(owner);
    await closeDb(worker);
  });

  beforeEach(async () => {
    await owner.execute(sql`
      update accounting_document
         set state = 'cancelled', lease_token = null, lease_expires_at = null, settles_at = null
       where state in ('pending', 'sending', 'failed', 'unknown')`);
    await owner.execute(sql`
      update accounting_source_setting
         set xero_mode = 'off', books_mode = case product when 'shop' then 'test_org' else 'off' end`);
  });

  /** The projection as the worker runs it (worker_app), with the books view for refunds. */
  const projection = () =>
    new AccountingProjection({
      facts: {} as never,
      shopFacts,
      settings: repos.settingReader,
      registry: repos.registry,
      books: {
        lookup: repos.lookup,
        creditNotes: repos.creditNotes,
        transitions: repos.transitions,
      },
    });

  async function sendAll(books: InMemoryAccounting) {
    let n = 0;
    const sender = new AccountingSender({
      workQueue: repos.workQueue,
      dueWork: repos.dueWork,
      transitions: repos.transitions,
      settings: repos.settingReader,
      portsByMode: { test_org: books },
      destinations: bound,
      transientErrorPrefixes: [],
      newLeaseToken: () => `lease-${randomUUID()}-${++n}`,
      log,
    });
    for (let round = 0; round < 6; round++) await sender.tick();
  }

  const refunder = (books: InMemoryAccounting) =>
    new AccountingCreditNoteRefund({
      refunds: repos.creditNoteRefunds,
      settings: repos.settingReader,
      portsByMode: { test_org: books.creditNoteRefunds },
      log,
    });

  /** A refund that went through, as the Shop records it, and its ids-only event. */
  async function refunded(
    orderId: string,
    amountPence: number,
    orderLineId: string | null,
    options: { settledOutside?: boolean } = {},
  ) {
    const row = await owner.execute<{ id: string }>(
      sql`insert into shop_refund
            (order_id, order_line_id, amount_pence, status, source, idempotency_key,
             requested_by_subject_id, updated_at, settled_outside_at, settled_outside_reference,
             settled_outside_reason, settled_outside_by_subject_id)
          values (${orderId}, ${orderLineId}, ${amountPence}, 'succeeded', 'admin',
                  ${`refund-${randomUUID()}`}, 'staff:integration', ${REFUNDED_AT.toISOString()}::timestamptz,
                  ${options.settledOutside ? REFUNDED_AT.toISOString() : null}::timestamptz,
                  ${options.settledOutside ? "manual-ref" : null}, ${options.settledOutside ? "card expired" : null},
                  ${options.settledOutside ? "staff:integration" : null})
          returning id`,
    );
    const refundId = row.rows[0]?.id as string;
    const [event] = await owner
      .insert(domainEvent)
      .values({
        aggregateType: "shop_refund",
        aggregateId: refundId,
        eventType: "shop.refund.completed",
        payload: { schemaVersion: 1, refundId, orderId, status: "succeeded" },
        schemaVersion: 1,
        producer: "shop-api",
      })
      .returning();
    return { refundId, event: event as NonNullable<typeof event> };
  }

  async function rowOf(reference: string) {
    const [row] = await owner
      .select()
      .from(accountingDocument)
      .where(
        and(
          eq(accountingDocument.laxReference, reference),
          eq(accountingDocument.targetMode, "test_org"),
        ),
      );
    return row;
  }

  async function creditNotesOf(orderId: string) {
    return owner
      .select()
      .from(accountingDocument)
      .where(
        and(
          eq(accountingDocument.kind, "credit_note"),
          eq(accountingDocument.targetMode, "test_org"),
          sql`${accountingDocument.payload} ->> 'invoiceReference' = ${`LAX-SHOP-INV-${orderId}`}`,
        ),
      );
  }

  async function paidAndSent(books: InMemoryAccounting) {
    const seeded = await seedPaidOrder(owner);
    await projection().project(seeded.event);
    await sendAll(books);
    expect(await rowOf(`LAX-SHOP-INV-${seeded.orderId}`)).toMatchObject({ state: "issued" });
    return seeded;
  }

  it("credits a line's refund, sends it after its invoice, and refunds it from clearing once", async () => {
    const books = new InMemoryAccounting();
    const { orderId, lines } = await paidAndSent(books);
    const [line] = lines;
    const { refundId, event } = await refunded(orderId, line?.pence ?? 0, line?.id ?? null);
    expect(await projection().project(event)).toMatchObject({ outcome: "projected", created: 1 });
    const noteRef = `LAX-SHOP-CN-${refundId}`;
    expect(await rowOf(noteRef)).toMatchObject({
      state: "pending",
      legalEntity: "london_art_exchange",
      grossPence: line?.pence,
    });
    await sendAll(books);
    expect(await rowOf(noteRef)).toMatchObject({ state: "issued" });
    // Six refunders at once: the money goes back once, and the history says so once.
    await Promise.all(Array.from({ length: 6 }, () => refunder(books).tick()));
    expect(books.creditNoteRefundOf("shop", noteRef)).toBe(line?.pence);
    const note = await rowOf(noteRef);
    const history = await owner
      .select()
      .from(accountingDocumentEvent)
      .where(
        and(
          eq(accountingDocumentEvent.documentId, note?.id as string),
          eq(accountingDocumentEvent.action, "refund_credit_note"),
        ),
      );
    expect(history).toHaveLength(1);
    // Projected again (a redelivery): nothing new.
    expect(await projection().project(event)).toMatchObject({ created: 0 });
  });

  it("credits two refunds projected many times at once exactly once each, never above the invoice", async () => {
    const books = new InMemoryAccounting();
    const { orderId, lines } = await paidAndSent(books);
    const first = await refunded(orderId, lines[0]?.pence ?? 0, lines[0]?.id ?? null);
    const second = await refunded(orderId, lines[1]?.pence ?? 0, lines[1]?.id ?? null);
    const attempts = [first.event, second.event, first.event, second.event].flatMap((event) =>
      Array.from({ length: 3 }, async () => {
        // A losing projection is refused as not yet and tried again with fresh facts.
        for (let tries = 0; tries < 8; tries++) {
          try {
            return await projection().project(event);
          } catch (error) {
            if (!String(error).includes("accounting_projection_not_yet")) throw error;
          }
        }
        throw new Error("never projected");
      }),
    );
    await Promise.all(attempts);
    const notes = await creditNotesOf(orderId);
    expect(notes.map((n) => n.grossPence).sort((a, b) => a - b)).toEqual([
      SECOND_PENCE,
      PRINT_PENCE,
    ]);
  });

  it("refuses a note built from refunds or credit that changed meanwhile (credit_prior_changed)", async () => {
    const books = new InMemoryAccounting();
    const { orderId, lines } = await paidAndSent(books);
    const first = await refunded(orderId, lines[0]?.pence ?? 0, lines[0]?.id ?? null);
    const read = await shopFacts.refundSettled(first.refundId);
    if (read.status !== "ready") throw new Error(read.reason);
    const built = projectShopRefundSettled({ ...read.facts, registered: [] });
    if (!built.ok) throw new Error(built.refusal.message);
    const note = built.value.documents.find((d) => d.kind === "credit_note") as CreditNote;
    const basis = {
      kind: "shop_refunds" as const,
      orderId,
      succeededRefunds: 1,
      builtAfter: [{ reference: note.reference, priorCreditPence: 0 }],
    };
    // Another refund went through after the facts were read.
    const second = await refunded(orderId, lines[1]?.pence ?? 0, lines[1]?.id ?? null);
    const stale = await repos.registry.register({
      document: note,
      sourceEventRef: "test",
      creditBasis: basis,
    });
    expect(stale.ok ? null : stale.refusal.code).toBe("credit_prior_changed");
    // The other credit on the invoice moved after the facts were read.
    await projection().project(second.event);
    const moved = await repos.registry.register({
      document: note,
      sourceEventRef: "test",
      creditBasis: { ...basis, succeededRefunds: 2 },
    });
    // Its own event registered it already (a replay, same document) or it is refused: never twice.
    const notes = await creditNotesOf(orderId);
    expect(notes.reduce((sum, n) => sum + n.grossPence, 0)).toBe(PRINT_PENCE + SECOND_PENCE);
    if (!moved.ok) expect(moved.refusal.code).toBe("credit_prior_changed");
    else expect(moved.value.created).toBe(false);
  });

  it("refuses for staff a part refund that names no line on an order of several lines", async () => {
    const books = new InMemoryAccounting();
    const { orderId } = await paidAndSent(books);
    const { event } = await refunded(orderId, 10_000, null);
    await expect(projection().project(event)).rejects.toThrow(
      /accounting_projection_refused:refund_unattributed/,
    );
    expect(await creditNotesOf(orderId)).toHaveLength(0);
  });

  it("parks a refund settled outside Stripe: credited, never sent, never refunded from clearing", async () => {
    const books = new InMemoryAccounting();
    const { orderId } = await paidAndSent(books);
    const { refundId, event } = await refunded(orderId, TOTAL, null, { settledOutside: true });
    expect(await projection().project(event)).toMatchObject({ created: 1, parked: 1 });
    const noteRef = `LAX-SHOP-CN-${refundId}`;
    const row = await rowOf(noteRef);
    expect(row).toMatchObject({
      state: "needs_review",
      needsReviewReason: "accounting_parked_refund_outside_stripe",
      grossPence: TOTAL,
    });
    expect((row?.payload as { refund?: unknown }).refund).toBeUndefined();
    await sendAll(books);
    expect((await refunder(books).tick()).refunded).toBe(0);
    expect(await rowOf(noteRef)).toMatchObject({ state: "needs_review" });
    expect(books.creditNoteRefundOf("shop", noteRef)).toBeNull();
  });

  it("never refunds from clearing a note whose Shop refund no longer stands; holds it for a person", async () => {
    const books = new InMemoryAccounting();
    const { orderId, lines } = await paidAndSent(books);
    const { refundId, event } = await refunded(orderId, lines[0]?.pence ?? 0, lines[0]?.id ?? null);
    await projection().project(event);
    await sendAll(books);
    // The Shop never moves a refund back from succeeded; the step checks it anyway.
    await owner.execute(sql`update shop_refund set status = 'failed' where id = ${refundId}`);
    const tick = await refunder(books).tick();
    expect(tick.refunded).toBe(0);
    expect(await rowOf(`LAX-SHOP-CN-${refundId}`)).toMatchObject({
      state: "needs_review",
      needsReviewReason: "accounting_refund_reversed_after_credit",
    });
    expect(books.creditNoteRefundOf("shop", `LAX-SHOP-CN-${refundId}`)).toBeNull();
  });
});
