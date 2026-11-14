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
async function seedPaidOrder(db: Database, options: { outsideUk?: boolean } = {}) {
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
        values (${subject}, ${options.outsideUk ? "international_quotation" : "uk_insured_delivery"},
                ${PRINT_PENCE + SECOND_PENCE}, 0, ${DELIVERY_PENCE}, null, ${TOTAL},
                ${`refund-${tag}`}, ${partyId})
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
    options: { settledOutside?: boolean; status?: "succeeded" | "failed"; at?: Date } = {},
  ) {
    const at = (options.at ?? REFUNDED_AT).toISOString();
    const row = await owner.execute<{ id: string }>(
      sql`insert into shop_refund
            (order_id, order_line_id, amount_pence, status, source, idempotency_key,
             requested_by_subject_id, updated_at, settled_outside_at, settled_outside_reference,
             settled_outside_reason, settled_outside_by_subject_id)
          values (${orderId}, ${orderLineId}, ${amountPence}, ${options.status ?? "succeeded"}, 'admin',
                  ${`refund-${randomUUID()}`}, 'staff:integration', ${at}::timestamptz,
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

  async function paidAndSent(books: InMemoryAccounting, options: { outsideUk?: boolean } = {}) {
    const seeded = await seedPaidOrder(owner, options);
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
    // The other credit on the invoice moved after the facts were read (the second refund's note).
    await projection().project(second.event);
    const moved = await repos.registry.register({
      document: note,
      sourceEventRef: "test",
      creditBasis: { ...basis, succeededRefunds: 2 },
    });
    expect(moved.ok ? null : moved.refusal.code).toBe("credit_prior_changed");
    const notes = await creditNotesOf(orderId);
    expect(notes.reduce((sum, n) => sum + n.grossPence, 0)).toBe(PRINT_PENCE + SECOND_PENCE);
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

  it.each([
    ["failed", sql`status = 'failed'`],
    [
      "settled outside Stripe",
      sql`settled_outside_at = now(), settled_outside_reference = 'manual-ref',
          settled_outside_reason = 'card expired', settled_outside_by_subject_id = 'staff:integration'`,
    ],
  ])(
    "never refunds from clearing a note whose Shop refund is now %s; holds it for a person",
    async (_, change) => {
      const books = new InMemoryAccounting();
      const { orderId, lines } = await paidAndSent(books);
      const { refundId, event } = await refunded(
        orderId,
        lines[0]?.pence ?? 0,
        lines[0]?.id ?? null,
      );
      await projection().project(event);
      await sendAll(books);
      // The Shop never moves a refund back from succeeded through Stripe; the step checks it anyway.
      await owner.execute(sql`update shop_refund set ${change} where id = ${refundId}`);
      const tick = await refunder(books).tick();
      expect(tick.refunded).toBe(0);
      expect(await rowOf(`LAX-SHOP-CN-${refundId}`)).toMatchObject({
        state: "needs_review",
        needsReviewReason: "accounting_refund_reversed_after_credit",
      });
      expect(books.creditNoteRefundOf("shop", `LAX-SHOP-CN-${refundId}`)).toBeNull();
    },
  );

  /** What the Shop writes when Stripe reports a refund failed after it succeeded (#1380 F2). */
  async function reversed(orderId: string, refundId: string) {
    await owner.execute(sql`update shop_refund set reversed_at = now() where id = ${refundId}`);
    const [event] = await owner
      .insert(domainEvent)
      .values({
        aggregateType: "shop_refund",
        aggregateId: refundId,
        eventType: "shop.refund.reversed",
        payload: { schemaVersion: 1, refundId, orderId },
        schemaVersion: 1,
        producer: "shop-api",
      })
      .returning();
    return event as NonNullable<typeof event>;
  }

  /** Projects an event, trying again (with fresh facts) while it is refused as not yet. */
  async function projectUntilSettled(
    make: () => AccountingProjection,
    event: Parameters<AccountingProjection["project"]>[0],
  ) {
    for (let tries = 0; tries < 12; tries++) {
      try {
        return await make().project(event);
      } catch (error) {
        if (!String(error).includes("accounting_projection_not_yet")) throw error;
      }
    }
    throw new Error("never projected");
  }

  const creditedOn = async (orderId: string) =>
    (await creditNotesOf(orderId)).filter((n) => n.state !== "cancelled");

  describe("review #1380", () => {
    it("F1: credits a return of the second invoice line alone, then the first, each on its own line", async () => {
      const books = new InMemoryAccounting();
      const { orderId, lines } = await paidAndSent(books);
      const second = await refunded(orderId, lines[1]?.pence ?? 0, lines[1]?.id ?? null);
      expect(await projection().project(second.event)).toMatchObject({ created: 1 });
      const first = await refunded(orderId, 10_000, lines[0]?.id ?? null);
      expect(await projection().project(first.event)).toMatchObject({ created: 1 });
      const notes = await creditedOn(orderId);
      expect(Object.fromEntries(notes.map((n) => [n.laxReference, n.grossPence]))).toEqual({
        [`LAX-SHOP-CN-${second.refundId}`]: lines[1]?.pence,
        [`LAX-SHOP-CN-${first.refundId}`]: 10_000,
      });
    });

    it("F1: a refund after one waiting for staff waits with it, on every event, so a hand booking is never credited again", async () => {
      const books = new InMemoryAccounting();
      const { orderId, lines } = await paidAndSent(books);
      const unclear = await refunded(orderId, 2_000, null, {
        at: new Date("2031-11-13T09:00:00Z"),
      });
      const later = await refunded(orderId, lines[0]?.pence ?? 0, lines[0]?.id ?? null);
      const last = await refunded(orderId, lines[1]?.pence ?? 0, lines[1]?.id ?? null);
      await expect(projection().project(unclear.event)).rejects.toThrow(/refund_unattributed/);
      for (const { event } of [later, last]) {
        await expect(projection().project(event)).rejects.toThrow(
          new RegExp(`refund_unattributed.*waits behind refund ${unclear.refundId}`),
        );
      }
      // Only the delivery line would be left once both lines were credited, where the first refund
      // would fit; it is never credited by another refund's event.
      expect(await creditedOn(orderId)).toHaveLength(0);
    });

    it("RV1: a projection held before it registers, while another refund commits and is projected in full", async () => {
      const books = new InMemoryAccounting();
      const { orderId, lines } = await paidAndSent(books);
      const first = await refunded(orderId, lines[0]?.pence ?? 0, lines[0]?.id ?? null);
      let release: () => void = () => {};
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      let reached: () => void = () => {};
      const atGate = new Promise<void>((resolve) => {
        reached = resolve;
      });
      let gated = true;
      const registry = new Proxy(repos.registry, {
        get(target, prop) {
          if (prop === "register") {
            return async (input: Parameters<typeof repos.registry.register>[0]) => {
              if (gated && input.document.kind === "credit_note") {
                gated = false;
                reached();
                await gate;
              }
              return target.register(input);
            };
          }
          const value = Reflect.get(target, prop);
          return typeof value === "function" ? value.bind(target) : value;
        },
      });
      const held = () =>
        new AccountingProjection({
          facts: {} as never,
          shopFacts,
          settings: repos.settingReader,
          registry,
          books: {
            lookup: repos.lookup,
            creditNotes: repos.creditNotes,
            transitions: repos.transitions,
          },
        });
      const p1 = projectUntilSettled(held, first.event);
      await atGate;
      const second = await refunded(orderId, lines[1]?.pence ?? 0, lines[1]?.id ?? null);
      await projectUntilSettled(projection, second.event);
      release();
      await p1;
      const notes = await creditedOn(orderId);
      expect(notes.map((n) => n.grossPence).sort((a, b) => a - b)).toEqual(
        [lines[1]?.pence, lines[0]?.pence].sort((a, b) => (a ?? 0) - (b ?? 0)),
      );
    });

    it("RV2: three refunds committing one after another while three projections per event race", async () => {
      const books = new InMemoryAccounting();
      const { orderId, lines } = await paidAndSent(books);
      const amounts: [string | null, number][] = [
        [lines[0]?.id ?? null, 10_000],
        [lines[1]?.id ?? null, lines[1]?.pence ?? 0],
        [lines[0]?.id ?? null, (lines[0]?.pence ?? 0) - 10_000],
      ];
      const running: Promise<unknown>[] = [];
      const made: string[] = [];
      for (const [lineId, pence] of amounts) {
        const { refundId, event } = await refunded(orderId, pence, lineId);
        made.push(refundId);
        for (let i = 0; i < 3; i++) running.push(projectUntilSettled(projection, event));
      }
      await Promise.all(running);
      const notes = await creditedOn(orderId);
      expect(Object.fromEntries(notes.map((n) => [n.laxReference, n.grossPence]))).toEqual(
        Object.fromEntries(made.map((id, i) => [`LAX-SHOP-CN-${id}`, amounts[i]?.[1]])),
      );
    });

    it("RV3: a refund row of the order that did not go through is never credited", async () => {
      const books = new InMemoryAccounting();
      const { orderId, lines } = await paidAndSent(books);
      // Recorded first, and it would fit its line if it were read.
      await refunded(orderId, lines[1]?.pence ?? 0, lines[1]?.id ?? null, {
        status: "failed",
        at: new Date("2031-11-13T09:00:00Z"),
      });
      const { refundId, event } = await refunded(
        orderId,
        lines[0]?.pence ?? 0,
        lines[0]?.id ?? null,
      );
      expect(await projection().project(event)).toMatchObject({ created: 1 });
      expect((await creditedOn(orderId)).map((n) => n.laxReference)).toEqual([
        `LAX-SHOP-CN-${refundId}`,
      ]);
    });

    it("P4: six refunders at once refund an issued note from clearing once, over twenty rounds", async () => {
      for (let round = 0; round < 20; round++) {
        const books = new InMemoryAccounting();
        const { orderId, lines } = await paidAndSent(books);
        const { refundId, event } = await refunded(
          orderId,
          lines[0]?.pence ?? 0,
          lines[0]?.id ?? null,
        );
        await projection().project(event);
        await sendAll(books);
        const noteRef = `LAX-SHOP-CN-${refundId}`;
        await Promise.all(Array.from({ length: 6 }, () => refunder(books).tick()));
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
        expect(history, `round ${round}`).toHaveLength(1);
        expect(books.creditNoteRefundOf("shop", noteRef)).toBe(lines[0]?.pence);
      }
    }, 180_000);

    it("F2: a refund reversed before its note is sent: the note is cancelled, never sent or refunded", async () => {
      const books = new InMemoryAccounting();
      const { orderId, lines } = await paidAndSent(books);
      const { refundId, event } = await refunded(
        orderId,
        lines[0]?.pence ?? 0,
        lines[0]?.id ?? null,
      );
      await projection().project(event);
      const reversal = await reversed(orderId, refundId);
      expect(await projection().project(reversal)).toMatchObject({ cancelled: 1 });
      await sendAll(books);
      expect((await refunder(books).tick()).refunded).toBe(0);
      expect(await rowOf(`LAX-SHOP-CN-${refundId}`)).toMatchObject({ state: "cancelled" });
      // Its own completed event, delivered again, credits nothing.
      expect(await projection().project(event)).toMatchObject({
        outcome: "skipped",
        reason: "refund_reversed",
      });
      // A later refund of the order is credited alone; the reversed one is never credited again.
      const other = await refunded(orderId, lines[1]?.pence ?? 0, lines[1]?.id ?? null);
      expect(await projection().project(other.event)).toMatchObject({ created: 1 });
      expect((await creditedOn(orderId)).map((n) => n.laxReference)).toEqual([
        `LAX-SHOP-CN-${other.refundId}`,
      ]);
    });

    it("F2: a refund reversed after its note was issued: held for a person, never refunded from clearing; a later refund is credited once", async () => {
      const books = new InMemoryAccounting();
      const { orderId, lines } = await paidAndSent(books);
      const { refundId, event } = await refunded(
        orderId,
        lines[0]?.pence ?? 0,
        lines[0]?.id ?? null,
      );
      await projection().project(event);
      await sendAll(books);
      const noteRef = `LAX-SHOP-CN-${refundId}`;
      expect(await rowOf(noteRef)).toMatchObject({ state: "issued" });
      const reversal = await reversed(orderId, refundId);
      expect(await projection().project(reversal)).toMatchObject({ held: 1 });
      expect((await refunder(books).tick()).refunded).toBe(0);
      expect(await rowOf(noteRef)).toMatchObject({
        state: "needs_review",
        needsReviewReason: "accounting_refund_reversed_after_credit",
      });
      expect(books.creditNoteRefundOf("shop", noteRef)).toBeNull();
      const other = await refunded(orderId, lines[1]?.pence ?? 0, lines[1]?.id ?? null);
      expect(await projection().project(other.event)).toMatchObject({ created: 1 });
      expect(await projection().project(other.event)).toMatchObject({ created: 0 });
      expect(await rowOf(noteRef)).toMatchObject({
        needsReviewReason: "accounting_refund_reversed_after_credit",
      });
    });

    it("F2: the clearing step holds a note whose refund was reversed even before the reversal is projected", async () => {
      const books = new InMemoryAccounting();
      const { orderId, lines } = await paidAndSent(books);
      const { refundId, event } = await refunded(
        orderId,
        lines[0]?.pence ?? 0,
        lines[0]?.id ?? null,
      );
      await projection().project(event);
      await sendAll(books);
      await reversed(orderId, refundId);
      expect((await refunder(books).tick()).refunded).toBe(0);
      expect(await rowOf(`LAX-SHOP-CN-${refundId}`)).toMatchObject({
        needsReviewReason: "accounting_refund_reversed_after_credit",
      });
    });

    it("F4: a whole-order refund of an order delivered outside the UK credits both invoices; the delivery's is parked", async () => {
      const books = new InMemoryAccounting();
      const { orderId } = await paidAndSent(books, { outsideUk: true });
      const deliveryRef = `LAX-SHOP-INV-${orderId}-delivery`;
      expect(await rowOf(deliveryRef)).toMatchObject({
        state: "needs_review",
        needsReviewReason: "accounting_parked_vat_on_outside_uk_delivery",
      });
      const { refundId, event } = await refunded(orderId, TOTAL, null);
      expect(await projection().project(event)).toMatchObject({ created: 2, parked: 1 });
      expect(await projection().project(event)).toMatchObject({ created: 0 });
      const orderNote = `LAX-SHOP-CN-${refundId}`;
      const deliveryNote = `LAX-SHOP-CN-${refundId}-delivery`;
      expect(await rowOf(orderNote)).toMatchObject({
        state: "pending",
        grossPence: TOTAL - DELIVERY_PENCE,
      });
      expect(await rowOf(deliveryNote)).toMatchObject({
        state: "needs_review",
        needsReviewReason: "accounting_parked_vat_on_outside_uk_delivery",
        grossPence: DELIVERY_PENCE,
      });
      await sendAll(books);
      await refunder(books).tick();
      expect(books.creditNoteRefundOf("shop", orderNote)).toBe(TOTAL - DELIVERY_PENCE);
      expect(books.creditNoteRefundOf("shop", deliveryNote)).toBeNull();
      expect(await rowOf(deliveryNote)).toMatchObject({ state: "needs_review" });
    });
  });
});
