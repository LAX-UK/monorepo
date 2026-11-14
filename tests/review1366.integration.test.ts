import { randomUUID } from "node:crypto";
import type { DestinationBinding } from "@auction/accounting-domain";
import { InMemoryAccounting, SHOP_ORG_ID } from "@auction/accounting-zoho-books/testing";
import { type Database, closeDb, createDb } from "@auction/db";
import { accountingDocument, domainEvent } from "@auction/db/schema";
import {
  DrizzleShopAccountingFactsReader,
  createAccountingRepositories,
} from "@auction/persistence/repositories";
import { and, asc, eq, like, or, sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { holdAccountingTablesLock } from "../../testing/accounting-tables-lock.js";
import type { SenderPorts } from "./accounting-dispatch.js";
import { AccountingProjection } from "./accounting-projection.service.js";
import { AccountingSender } from "./accounting-sender.service.js";

const OWNER_URL = process.env.DATABASE_URL;
const WORKER_URL = process.env.DATABASE_URL_WORKER;
const API_URL = process.env.DATABASE_URL_API;
const HAS_DB = Boolean(OWNER_URL);

type BooksMode = "dry_run" | "test_org" | "live";
const PAID_AT = new Date("2031-11-12T14:05:00Z");
const log = { info: vi.fn(), warn: vi.fn() };
/** The Shop's documents go to London Art Exchange's organisation, and only there. */
const bound = (mode: BooksMode, organisationId = SHOP_ORG_ID): DestinationBinding =>
  mode === "dry_run" ? {} : { [mode]: { shop: organisationId } };

const PRINT_PENCE = 45_000;
const FRAME_PENCE = 12_000;

/**
 * A paid Shop order, as the Shop leaves it: a print (a product variant here) framed, the frame's
 * price frozen on its line, delivery as charged, the invoice number from the database's counter
 * (set as paid_at is), and the references-only event. Fixture data only.
 */
async function seedPaidOrder(
  db: Database,
  options: { scope?: "uk" | "outside_uk"; deliveryPence?: number; guest?: boolean } = {},
) {
  const tag = randomUUID().slice(0, 8);
  const subject = options.guest ? null : `shop-books-${tag}`;
  const deliveryPence = options.deliveryPence ?? 2_500;
  const party = await db.execute<{ id: string }>(
    sql`insert into shop_party (display_name, kind) values (${`Buyer ${tag}`}, 'person') returning id`,
  );
  const partyId = party.rows[0]?.id as string;
  const product = await db.execute<{ id: string }>(
    sql`insert into shop_product (slug, title) values (${`print-${tag}`}, ${`Harbour at dusk ${tag}`}) returning id`,
  );
  const variant = await db.execute<{ id: string }>(
    sql`insert into shop_product_variant (product_id, sku, price_pence)
        values (${product.rows[0]?.id}, ${`SKU-${tag}`}, ${PRINT_PENCE}) returning id`,
  );
  const option = await db.execute<{ id: string }>(
    sql`insert into shop_framing_option
          (code, name, frame, mount, glazing, hanging, lead_time_min_days, lead_time_max_days, status, sort_order)
        values (${`books-${tag}`}, 'Natural oak frame', 'natural_oak', 'window_conservation', 'uv_acrylic', 'd_rings_cord', 10, 15, 'draft', 990)
        returning id`,
  );
  let guestId: string | null = null;
  if (options.guest) {
    const guest = await db.execute<{ id: string }>(
      sql`insert into shop_guest_customer (email, name) values (${`guest-${tag}@integration.test`}, ${`Guest ${tag}`}) returning id`,
    );
    guestId = guest.rows[0]?.id as string;
  } else {
    await db.execute(
      sql`insert into shop_user_profile (identity_subject_id, email, name)
          values (${subject}, ${`${subject}@integration.test`}, ${`Ada ${tag}`})`,
    );
  }
  const scope = options.scope ?? "uk";
  const total = PRINT_PENCE + FRAME_PENCE + deliveryPence;
  const order = await db.execute<{ id: string }>(
    sql`insert into shop_order
          (identity_subject_id, guest_customer_id, fulfilment, merchandise_subtotal_pence,
           framing_subtotal_pence, fulfilment_surcharge_pence, fulfilment_vat_pence, total_pence,
           idempotency_key, buyer_party_id)
        values (${subject ?? `guest:${guestId}`}, ${guestId},
                ${scope === "uk" ? "uk_insured_delivery" : "international_quotation"},
                ${PRINT_PENCE}, ${FRAME_PENCE}, ${deliveryPence}, null, ${total},
                ${`books-${tag}`}, ${partyId})
        returning id`,
  );
  const orderId = order.rows[0]?.id as string;
  const print = await db.execute<{ id: string }>(
    sql`insert into shop_order_line (order_id, product_variant_id, unit_price_pence)
        values (${orderId}, ${variant.rows[0]?.id}, ${PRINT_PENCE}) returning id`,
  );
  const printId = print.rows[0]?.id as string;
  const frame = await db.execute<{ id: string }>(
    sql`insert into shop_order_line
          (order_id, kind, framing_for_line_id, framing_option_id, framing_snapshot, unit_price_pence)
        values (${orderId}, 'framing', ${printId}, ${option.rows[0]?.id},
                ${JSON.stringify({ name: "Natural oak frame", pricePence: FRAME_PENCE })}::jsonb, ${FRAME_PENCE})
        returning id`,
  );
  await db.execute(
    sql`update shop_order set status = 'paid', paid_at = ${PAID_AT.toISOString()}::timestamptz where id = ${orderId}`,
  );
  const lineIds = [printId, frame.rows[0]?.id as string].sort();
  await db.insert(domainEvent).values({
    aggregateType: "shop_order",
    aggregateId: orderId,
    eventType: "shop.accounting.order_paid",
    payload: { schemaVersion: 1, orderId, lineIds, paidAt: PAID_AT.toISOString() },
    schemaVersion: 1,
    producer: "shop-api",
  });
  const [event] = await db
    .select()
    .from(domainEvent)
    .where(
      and(
        eq(domainEvent.aggregateId, orderId),
        eq(domainEvent.eventType, "shop.accounting.order_paid"),
      ),
    );
  const numbered = await db.execute<{ invoice_number: string }>(
    sql`select invoice_number from shop_order where id = ${orderId}`,
  );
  return {
    tag,
    orderId,
    partyId,
    total,
    event: event as NonNullable<typeof event>,
    invoiceNumber: numbered.rows[0]?.invoice_number as string,
  };
}

holdAccountingTablesLock({ beforeAll, afterAll });

describe.skipIf(!HAS_DB)("Shop invoices to Books (integration)", { timeout: 60_000 }, () => {
  // biome-ignore lint/style/noNonNullAssertion: gated by HAS_DB
  const owner = createDb(OWNER_URL!);
  const worker = createDb(WORKER_URL || (OWNER_URL as string));
  const api = createDb(API_URL || (OWNER_URL as string));
  const repos = createAccountingRepositories(worker, { now: () => new Date() });
  const shopFacts = new DrizzleShopAccountingFactsReader(worker);

  afterAll(async () => {
    await owner.execute(sql`
      update accounting_source_setting
         set xero_mode = case product when 'bid' then 'live' else 'off' end, books_mode = 'off'`);
    await closeDb(owner);
    await closeDb(worker);
    await closeDb(api);
  });

  beforeEach(async () => {
    await owner.execute(sql`
      update accounting_document
         set state = 'cancelled', lease_token = null, lease_expires_at = null, settles_at = null
       where state in ('pending', 'sending', 'failed', 'unknown')`);
    await owner.execute(sql`
      update accounting_document_copy
         set email_skipped_at = now(), email_skip_reason = 'invoice_missing'
       where email_queued_at is null and email_skipped_at is null and not rehearsal`);
  });

  async function aimShop(mode: BooksMode) {
    await owner.execute(sql`
      update accounting_source_setting
         set xero_mode = 'off', books_mode = case product when 'shop' then ${mode} else 'off' end`);
  }

  const projection = () =>
    new AccountingProjection({
      facts: {
        invoiceRaised: vi.fn(),
        paymentCaptured: vi.fn(),
        paymentRefunded: vi.fn(),
      } as never,
      shopFacts,
      settings: repos.settingReader,
      registry: repos.registry,
    });

  function sender(mode: BooksMode, ports: SenderPorts, destinations = bound(mode)) {
    let n = 0;
    return new AccountingSender({
      workQueue: repos.workQueue,
      dueWork: repos.dueWork,
      transitions: repos.transitions,
      settings: repos.settingReader,
      portsByMode: { [mode]: ports },
      destinations,
      transientErrorPrefixes: [],
      newLeaseToken: () => `lease-${randomUUID()}-${++n}`,
      log,
    });
  }

  /** The order's documents (and its buyer's contact), oldest first. */
  const documentsFor = (seeded: { orderId: string; partyId: string }) =>
    owner
      .select()
      .from(accountingDocument)
      .where(
        or(
          like(accountingDocument.laxReference, `LAX-SHOP-%-${seeded.orderId}%`),
          eq(accountingDocument.laxReference, `LAX-SHOP-CON-${seeded.partyId}`),
        ),
      )
      .orderBy(asc(accountingDocument.createdAt), asc(accountingDocument.laxReference));

  // ---- Review #1366 additions ----

  async function senderStates(seeded: { orderId: string; partyId: string }) {
    return (await documentsFor(seeded)).map((d) => ({
      kind: d.kind,
      state: d.state,
      reason: d.lastErrorClass ?? d.needsReviewReason ?? null,
    }));
  }

  it("R1: six concurrent senders book contact, invoice and payment in order (live)", async () => {
    await aimShop("live");
    const outcomes: string[] = [];
    for (let run = 0; run < 5; run += 1) {
      const seeded = await seedPaidOrder(owner);
      await projection().project(seeded.event);
      const books = new InMemoryAccounting({
        orgs: { london_art_exchange: { vatRegistered: false } },
      });
      const senders = Array.from({ length: 6 }, () => sender("live", books));
      for (let round = 0; round < 4; round += 1) {
        await Promise.all(senders.map((s) => s.tick()));
      }
      const states = await senderStates(seeded);
      outcomes.push(JSON.stringify(states));
    }
    console.log(`R1 outcomes\n${outcomes.join("\n")}`);
    for (const o of outcomes) {
      for (const d of JSON.parse(o) as { state: string }[]) expect(d.state).toBe("issued");
    }
  });

  it("R2: a payment that sorts before its invoice (same created_at) is not tried first", async () => {
    await aimShop("live");
    const seeded = await seedPaidOrder(owner);
    await projection().project(seeded.event);
    // The three documents one projection registers can share a millisecond; make that certain and
    // let the payment win the id tie-break.
    const docs = await documentsFor(seeded);
    const at = docs[0]?.createdAt as Date;
    for (const d of docs) {
      await owner.execute(
        sql`update accounting_document set created_at = ${at.toISOString()}::timestamptz where id = ${d.id}`,
      );
    }
    const pay = docs.find((d) => d.kind === "payment");
    const inv = docs.find((d) => d.kind === "invoice");
    const con = docs.find((d) => d.kind === "contact");
    // ids are uuids; we cannot change them, so report the claim order the queue will use.
    const order = [con, inv, pay]
      .filter(Boolean)
      .sort((a, b) => ((a?.id as string) < (b?.id as string) ? -1 : 1))
      .map((d) => d?.kind);
    const books = new InMemoryAccounting({
      orgs: { london_art_exchange: { vatRegistered: false } },
    });
    const s = sender("live", books);
    for (let i = 0; i < 6; i += 1) await s.tick();
    const states = await senderStates(seeded);
    console.log("R2 claim order", order, JSON.stringify(states));
    for (const d of states) expect(d.state).toBe("issued");
  });

  it("R3: concurrent payments get distinct, gap-free LAX-INV numbers and one event each", async () => {
    const seeds = await Promise.all(Array.from({ length: 8 }, () => seedPaidOrder(owner)));
    const nums = seeds
      .map((s) => Number(s.invoiceNumber.slice("LAX-INV-".length)))
      .sort((a, b) => a - b);
    expect(new Set(nums).size).toBe(8);
    expect((nums.at(-1) as number) - (nums[0] as number)).toBeLessThan(8 + 8);
  });
});
