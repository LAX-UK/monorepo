import { randomUUID } from "node:crypto";
import type { DestinationBinding, PayoutBooking } from "@auction/accounting-domain";
import { createZohoBooksDryRunAdapter } from "@auction/accounting-zoho-books";
import {
  BID_ORG_ID,
  InMemoryAccounting,
  testOrgConfigs,
} from "@auction/accounting-zoho-books/testing";
import { type Database, closeDb, createDb } from "@auction/db";
import { accountingDocument } from "@auction/db/schema";
import {
  DrizzlePayoutAccountingFactsReader,
  DrizzleStripeReconciliationStore,
  createAccountingRepositories,
} from "@auction/persistence/repositories";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { holdAccountingTablesLock } from "../../testing/accounting-tables-lock.js";
import type { SenderPorts } from "./accounting-dispatch.js";
import { ACCOUNTING_EVENT_ROUTES, payoutEventRoutes } from "./accounting-event-routes.js";
import { AccountingProjection } from "./accounting-projection.service.js";
import { AccountingSender } from "./accounting-sender.service.js";

const OWNER_URL = process.env.DATABASE_URL;
const WORKER_URL = process.env.DATABASE_URL_WORKER;
const HAS_DB = Boolean(OWNER_URL);

const log = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
/** The accountant's answer as a test gives it, to rehearse the path that sends. */
const ANSWERED: PayoutBooking = {
  owedTreatment: "margin_scheme",
  commission: "netted",
  basis: "principal",
};

/** Two lot sales on agreements: £1,000 at 15% + VAT and £250.55 at 10% + VAT. Fixture data only. */
const SALES = [
  { hammer: 100_000, bps: 1_500, commission: 15_000, vat: 3_000, net: 82_000 },
  { hammer: 25_055, bps: 1_000, commission: 2_506, vat: 501, net: 22_048 },
] as const;
const NET = 104_048;
const pounds = (pence: number) => (pence / 100).toFixed(2);

/** A London day of its own for each seeded payout, so the day's totals are only its own. */
let dayOffset = Math.floor(Math.random() * 3_000);
function uniqueDay(): Date {
  dayOffset += 1;
  return new Date(Date.UTC(2040, 0, 1, 12) + dayOffset * 86_400_000);
}

type BidPayoutSeed = {
  payoutId: string;
  sellerId: string;
  createdAt: Date;
};

/**
 * A Bid seller payout as settlement leaves it: two lot sales paid from their seller-terms
 * snapshots on signed agreements, the payout's ledger figures, and its sale lines.
 */
async function seedBidPayout(
  db: Database,
  options: { adjustment?: boolean } = {},
): Promise<BidPayoutSeed> {
  const tag = randomUUID().slice(0, 8);
  const userId = `payout-books-${tag}`;
  const one = async (query: ReturnType<typeof sql>) =>
    ((await db.execute<{ id: string }>(query)).rows[0]?.id ?? "") as string;
  await db.execute(sql`insert into "user" (id, name, email, created_at, updated_at)
    values (${userId}, 'Seller (fixture)', ${`${userId}@integration.test`}, now(), now())`);
  const sellerId =
    await one(sql`insert into legal_entity (kind, subkind, display_name, created_by_user_id)
    values ('organisation', 'gallery', ${`Gallery ${tag}`}, ${userId}) returning id`);
  const buyerId =
    await one(sql`insert into legal_entity (kind, subkind, display_name, created_by_user_id)
    values ('individual', 'private_collector', ${`Buyer ${tag}`}, ${userId}) returning id`);
  const saleId =
    await one(sql`insert into sale (title, start_time, end_time, created_by_legal_entity_id)
    values (${`Sale ${tag}`}, now(), now() + interval '1 day', ${sellerId}) returning id`);
  const createdAt = uniqueDay();
  const payoutId = await one(sql`insert into payout
      (legal_entity_id, period_start, period_end, gross_amount, platform_fee, stripe_fee, net_amount,
       hammer_amount, commission_amount, commission_vat_amount, created_at)
    values (${sellerId}, ${new Date(createdAt.getTime() - 7 * 86_400_000).toISOString()}::timestamptz,
       ${createdAt.toISOString()}::timestamptz, ${pounds(125_055 + (options.adjustment ? -500 : 0))},
       ${pounds(21_007)}, '0.00', ${pounds(NET + (options.adjustment ? -500 : 0))},
       ${pounds(125_055)}, ${pounds(17_506)}, ${pounds(3_501)}, ${createdAt.toISOString()}::timestamptz)
    returning id`);
  for (const [i, s] of SALES.entries()) {
    const lotId = await one(sql`insert into lot
        (sale_id, title, auction_type, starting_price, current_price, start_time, end_time, seller_legal_entity_id)
      values (${saleId}, ${`Lot ${i} ${tag}`}, 'english', 0, ${pounds(s.hammer)}, now(),
        now() + interval '1 day', ${sellerId}) returning id`);
    const paymentId = await one(sql`insert into payment
        (lot_id, buyer_id, buyer_legal_entity_id, seller_legal_entity_id, amount, platform_fee)
      values (${lotId}, ${userId}, ${buyerId}, ${sellerId}, ${pounds(s.hammer)}, 0) returning id`);
    const submissionId =
      await one(sql`insert into item_submission (legal_entity_id, title, converted_lot_id)
      values (${sellerId}, 'Consigned work', ${lotId}) returning id`);
    const agreementId = await one(sql`insert into consignment_agreement
        (submission_id, legal_entity_id, terms_version, commission_percent, accepted_at)
      values (${submissionId}, ${sellerId}, 'v1', ${(s.bps / 100).toFixed(2)}, now()) returning id`);
    const termsId = await one(sql`insert into sale_seller_terms
        (payment_id, lot_id, seller_legal_entity_id, agreement_id, basis, hammer_pence, premium_pence,
         commission_bps, commission_pence, commission_vat_treatment, commission_vat_bps,
         commission_vat_pence, seller_net_pence, rule_version)
      values (${paymentId}, ${lotId}, ${sellerId}, ${agreementId}, 'agreement', ${s.hammer}, 0,
        ${s.bps}, ${s.commission}, 'standard', 2000, ${s.vat}, ${s.net}, 'integration-v1')
      returning id`);
    await db.execute(sql`insert into payout_line (payout_id, payment_id, seller_terms_id, amount, kind)
      values (${payoutId}, ${paymentId}, ${termsId}, ${pounds(s.hammer)}, 'sale')`);
  }
  if (options.adjustment) {
    await db.execute(sql`insert into payout_line (payout_id, amount, kind, created_by_user_id, note)
      values (${payoutId}, '-5.00', 'adjustment', ${userId}, 'Fixture adjustment')`);
  }
  return { payoutId, sellerId, createdAt };
}

async function markBidPaid(db: Database, payoutId: string, throughStripe = true): Promise<Date> {
  const paidAt = uniqueDay();
  await db.execute(sql`update payout
       set status = 'paid', processed_at = ${paidAt.toISOString()}::timestamptz,
           stripe_transfer_id = ${throughStripe ? `tr_${randomUUID().replace(/-/g, "")}` : null}
     where id = ${payoutId}`);
  return paidAt;
}

/** A Shop artist payout for an original sold in the Shop, paid by a Connect transfer or by hand. */
async function seedShopPayout(
  db: Database,
  options: { throughStripe?: boolean; payeeKind?: "artist" | "lax" } = {},
) {
  const tag = randomUUID().slice(0, 8);
  const one = async (query: ReturnType<typeof sql>) =>
    ((await db.execute<{ id: string }>(query)).rows[0]?.id ?? "") as string;
  const artistParty = await one(
    sql`insert into shop_party (display_name) values (${`Artist ${tag}`}) returning id`,
  );
  const buyerParty = await one(
    sql`insert into shop_party (display_name) values (${`Buyer ${tag}`}) returning id`,
  );
  const artist = await one(sql`insert into shop_artist (party_id, slug)
    values (${artistParty}, ${`artist-${tag}`}) returning id`);
  const artwork = await one(sql`insert into shop_artwork
      (artist_id, title, slug, eligible_for_edition_allocation, import_key)
    values (${artist}, ${`Work ${tag}`}, ${`payout-${tag}`}, false, ${`payout-${tag}`}) returning id`);
  const sale = await one(sql`insert into shop_original_sale
      (artwork_id, buyer_party_id, sale_price_pence, recorded_by_subject_id, status, invoice_issuer)
    values (${artwork}, ${buyerParty}, 45000, 'staff:integration', 'invoiced', 'stripe') returning id`);
  const createdAt = uniqueDay();
  const paidAt = new Date(createdAt.getTime() + 86_400_000);
  const payoutId = await one(sql`insert into shop_payout_ledger
      (original_sale_id, owner_party_id, gross_pence, deductions_pence, net_pence, payout_due_at,
       status, source, payee_kind, paid_at, paid_reference, paid_by_subject_id, created_at)
    values (${sale}, ${artistParty}, 45000, 13500, 31500, ${paidAt.toISOString()}::timestamptz,
      'paid', 'original_sale', ${options.payeeKind ?? "artist"}, ${paidAt.toISOString()}::timestamptz,
      'free text staff wrote (fixture)',
      ${options.throughStripe === false ? "staff:integration" : "system:stripe-connect"},
      ${createdAt.toISOString()}::timestamptz)
    returning id`);
  return { payoutId, artistParty, sale, paidAt };
}

holdAccountingTablesLock({ beforeAll, afterAll });

describe.skipIf(!HAS_DB)(
  "Seller and artist payouts as Books bills (integration)",
  { timeout: 60_000 },
  () => {
    // biome-ignore lint/style/noNonNullAssertion: gated by HAS_DB
    const owner = createDb(OWNER_URL!);
    const worker = createDb(WORKER_URL || (OWNER_URL as string));
    const repos = createAccountingRepositories(worker, { now: () => new Date() });
    const payoutFacts = new DrizzlePayoutAccountingFactsReader(worker);
    let eventId = 9_000_000;

    afterAll(async () => {
      // Leave no parked payout document behind: other suites page "Needs a person".
      await owner.execute(sql`
        update accounting_document
           set state = 'cancelled', review_lookup = null, needs_review_reason = null
         where state = 'needs_review' and kind in ('bill', 'bill_payment')
           and needs_review_reason like 'accounting_parked_%payout%'`);
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
    });

    async function aim(product: "bid" | "shop", mode: "dry_run" | "test_org") {
      await owner.execute(sql`
        update accounting_source_setting
           set xero_mode = 'off', books_mode = case product when ${product} then ${mode} else 'off' end`);
    }

    /** The projection as the worker builds it, or with the accountant's answers given. */
    const projection = (answered = false) =>
      new AccountingProjection({
        facts: {} as never,
        payoutFacts,
        settings: repos.settingReader,
        registry: repos.registry,
        ...(answered
          ? {
              routes: {
                ...ACCOUNTING_EVENT_ROUTES,
                ...payoutEventRoutes({ bid: ANSWERED, shop: ANSWERED }),
              },
            }
          : {}),
      });

    const event = (eventType: string, aggregateId: string, payload: unknown = {}) => ({
      id: ++eventId,
      eventType,
      aggregateId,
      payload,
    });

    async function drain(
      mode: "dry_run" | "test_org",
      ports: SenderPorts,
      destinations: DestinationBinding,
    ) {
      let n = 0;
      const sender = new AccountingSender({
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
      for (let i = 0; i < 6; i += 1) await sender.tick();
    }

    const docsOf = (references: string[]) =>
      owner
        .select()
        .from(accountingDocument)
        .where(inArray(accountingDocument.laxReference, references))
        .orderBy(asc(accountingDocument.createdAt), asc(accountingDocument.laxReference));

    const bidRefs = (seed: { payoutId: string; sellerId: string }) => [
      `LAX-BID-CON-vendor-${seed.sellerId}`,
      `LAX-BID-BILL-${seed.payoutId}`,
      `LAX-BID-BPAY-${seed.payoutId}`,
    ];

    it("reads a Bid payout as the worker role, its bill to the penny of the payout ledger", async () => {
      const seed = await seedBidPayout(owner);
      const read = await payoutFacts.bidPayout(seed.payoutId);
      if (read.status !== "ready") throw new Error(read.reason);
      expect(read.facts).toMatchObject({
        payoutId: seed.payoutId,
        seller: { id: seed.sellerId },
        grossPence: 125_055,
        platformFeePence: 21_007,
        stripeFeePence: 0,
        netPence: NET,
        otherLines: 0,
        paid: null,
      });
      expect(
        read.facts.sales.map((s) => [
          s.hammerPence,
          s.commissionPence,
          s.commissionVatPence,
          s.sellerNetPence,
        ]),
      ).toEqual(SALES.map((s) => [s.hammer, s.commission, s.vat, s.net]));
    });

    describe("a snapshot line is itemised only when it checks out", () => {
      const unmapped = async (change: (payoutId: string, sellerId: string) => Promise<void>) => {
        const seed = await seedBidPayout(owner);
        await change(seed.payoutId, seed.sellerId);
        const read = await payoutFacts.bidPayout(seed.payoutId);
        if (read.status !== "ready") throw new Error(read.reason);
        // One sale line is left out of the itemisation, so the payout is parked for a person.
        expect([read.facts.sales.length, read.facts.otherLines]).toEqual([SALES.length - 1, 1]);
        return seed;
      };
      // The table's triggers refuse to change an agreement row, so a mismatch is set by hand as the
      // owner, as a snapshot written by a faulty release would be. (A snapshot with another basis,
      // or an agreement basis with no agreement, is already refused by the table's own CHECKs.)
      const asFaulty = (statement: ReturnType<typeof sql>) =>
        owner.transaction(async (tx) => {
          await tx.execute(sql`set local session_replication_role = replica`);
          await tx.execute(statement);
        });
      const firstTerms = (payoutId: string) => sql`(select seller_terms_id from payout_line
        where payout_id = ${payoutId} and kind = 'sale' order by created_at, id limit 1)`;

      it("another legal entity's snapshot is not itemised", async () => {
        await unmapped(async (payoutId) => {
          const other = (
            await owner.execute<{ id: string }>(sql`insert into legal_entity
              (kind, subkind, display_name, created_by_user_id)
              select 'organisation', 'gallery', 'Other seller (fixture)', created_by_user_id
                from legal_entity where id = (select legal_entity_id from payout where id = ${payoutId})
              returning id`)
          ).rows[0]?.id;
          await asFaulty(sql`update sale_seller_terms set seller_legal_entity_id = ${other}
            where id = ${firstTerms(payoutId)}`);
        });
      });

      it("commission VAT that disagrees with its rate is not itemised", async () => {
        await unmapped(async (payoutId) => {
          await asFaulty(sql`update sale_seller_terms set commission_vat_bps = 1000
            where id = ${firstTerms(payoutId)}`);
        });
      });
    });

    it("parks the bill and its payment in dry run while the accountant has not answered; nothing is sent", async () => {
      await aim("bid", "dry_run");
      const seed = await seedBidPayout(owner);
      expect(
        await projection().project(event("payout.settlement_created", seed.payoutId)),
      ).toMatchObject({
        created: 2,
        parked: 1,
      });
      await markBidPaid(owner, seed.payoutId);
      expect(await projection().project(event("payout.paid", seed.payoutId))).toMatchObject({
        created: 1,
        replayed: 2,
        parked: 1,
      });
      await drain("dry_run", createZohoBooksDryRunAdapter({ orgs: testOrgConfigs() }), {});
      const docs = await docsOf(bidRefs(seed));
      expect(docs.map((d) => [d.kind, d.state, d.needsReviewReason, d.grossPence])).toEqual([
        ["contact", "issued", null, 0],
        ["bill", "needs_review", "accounting_parked_seller_payout_treatment", NET],
        ["bill_payment", "needs_review", "accounting_parked_seller_payout_treatment", NET],
      ]);
      // The parked rows read back through the domain's rules: a valid document, kept for a person.
      for (const ref of bidRefs(seed).slice(1)) {
        const found = await repos.lookup.findByReference("bid", ref, {
          provider: "books",
          mode: "dry_run",
        });
        expect(found.ok && found.value?.document.reference).toBe(ref);
      }
    });

    it("api_app cannot release a parked payout document, even unchanged", async () => {
      await aim("bid", "dry_run");
      const seed = await seedBidPayout(owner);
      await projection().project(event("payout.settlement_created", seed.payoutId));
      const [bill] = await docsOf([`LAX-BID-BILL-${seed.payoutId}`]);
      if (!bill) throw new Error("no bill");
      const refused = await owner
        .transaction(async (tx) => {
          await tx.execute(sql`set local role api_app`);
          await tx.execute(sql`update accounting_document
               set state = 'pending', review_lookup = null, needs_review_reason = null
             where id = ${bill.id}`);
        })
        .then(() => null)
        .catch(
          (e: { cause?: { code?: string }; code?: string }) => e.cause?.code ?? e.code ?? "thrown",
        );
      expect(refused).toBe("42501");
      const [still] = await docsOf([`LAX-BID-BILL-${seed.payoutId}`]);
      expect(still?.state).toBe("needs_review");
    });

    it("once answered, rehearses vendor, bill and payment in dry run: the ledger's figures, once each", async () => {
      await aim("bid", "dry_run");
      const seed = await seedBidPayout(owner);
      // Six projectors at once, then a redelivery: one document each.
      await Promise.all(
        Array.from({ length: 6 }, () =>
          projection(true).project(event("payout.settlement_created", seed.payoutId)),
        ),
      );
      expect(
        await projection(true).project(event("payout.settlement_created", seed.payoutId)),
      ).toMatchObject({ created: 0, replayed: 2, kept: 0, parked: 0 });
      await markBidPaid(owner, seed.payoutId);
      await Promise.all(
        Array.from({ length: 6 }, () =>
          projection(true).project(event("payout.paid", seed.payoutId)),
        ),
      );
      await drain("dry_run", createZohoBooksDryRunAdapter({ orgs: testOrgConfigs() }), {});
      const docs = await docsOf(bidRefs(seed));
      expect(
        docs.map((d) => [d.kind, d.legalEntity, d.targetMode, d.state, d.providerNumber]),
      ).toEqual([
        ["contact", "london_auction_xchange", "dry_run", "issued", "DRY-RUN"],
        ["bill", "london_auction_xchange", "dry_run", "issued", "DRY-RUN"],
        ["bill_payment", "london_auction_xchange", "dry_run", "issued", "DRY-RUN"],
      ]);
      const [, bill, payment] = docs;
      // To the penny: the bill is the payout's net, line by line the sales' seller nets.
      expect([bill?.grossPence, bill?.vatPence, payment?.grossPence]).toEqual([NET, 0, NET]);
      const lines = (bill?.payload as { lines: { unitNetPence: number }[] }).lines;
      expect(lines.map((l) => l.unitNetPence)).toEqual(SALES.map((s) => s.net));
      // The commission split: what the seller is owed plus what LAX kept is the hammer.
      const kept = SALES.reduce((n, s) => n + s.commission + s.vat, 0);
      expect((bill?.grossPence ?? 0) + kept).toBe(125_055);
      expect(payment?.payload).toMatchObject({
        billReference: `LAX-BID-BILL-${seed.payoutId}`,
        contactReference: `LAX-BID-CON-vendor-${seed.sellerId}`,
        paidFrom: "stripe_clearing",
        amountPence: NET,
      });
      expect(payment?.providerId).toBe(`dry-run:LAX-BID-BPAY-${seed.payoutId}`);
    });

    it("dry run makes no Books call: an adapter that would reach an organisation is never used", async () => {
      await aim("bid", "dry_run");
      const seed = await seedBidPayout(owner);
      await projection(true).project(event("payout.settlement_created", seed.payoutId));
      await markBidPaid(owner, seed.payoutId);
      await projection(true).project(event("payout.paid", seed.payoutId));
      // A writing fake handed to the dry run: it names the Books organisation it stands for.
      const books = new InMemoryAccounting({ firstProviderId: 8_100_000_000_001 });
      const vendor = vi.spyOn(books.vendors, "upsertVendor");
      const bills = vi.spyOn(books.bills, "issueBill");
      const payments = vi.spyOn(books.billPayments, "recordBillPayment");
      await drain("dry_run", books, {});
      expect([
        vendor.mock.calls.length,
        bills.mock.calls.length,
        payments.mock.calls.length,
      ]).toEqual([0, 0, 0]);
      const docs = await docsOf(bidRefs(seed));
      expect(docs.every((d) => d.state !== "issued")).toBe(true);
    });

    it("in the test organisation the payee is a supplier: the bill and its payment land on it", async () => {
      await aim("bid", "test_org");
      const seed = await seedBidPayout(owner);
      await projection(true).project(event("payout.settlement_created", seed.payoutId));
      await markBidPaid(owner, seed.payoutId);
      await projection(true).project(event("payout.paid", seed.payoutId));
      const books = new InMemoryAccounting({ firstProviderId: 8_200_000_000_001 });
      await drain("test_org", books, { test_org: { bid: BID_ORG_ID } });
      const docs = await docsOf(bidRefs(seed));
      expect(docs.map((d) => [d.kind, d.targetMode, d.state, d.lastErrorClass])).toEqual([
        ["contact", "test_org", "issued", null],
        ["bill", "test_org", "issued", null],
        ["bill_payment", "test_org", "issued", null],
      ]);
      const [, bill, payment] = docs;
      if (!bill || !payment) throw new Error("documents missing");
      // Found in the fake Books as sent: the bill for the payout's net, its payment the same.
      for (const doc of [bill, payment]) {
        const found = await books.lookup.findDocument(
          doc.payload as unknown as Parameters<typeof books.lookup.findDocument>[0],
        );
        expect(found).toMatchObject({ status: "found", totals: { grossPence: NET } });
      }
    });

    it("bills a payout holding an adjustment whole, parked for a person", async () => {
      await aim("bid", "dry_run");
      const seed = await seedBidPayout(owner, { adjustment: true });
      await projection(true).project(event("payout.settlement_created", seed.payoutId));
      const [bill] = await docsOf([`LAX-BID-BILL-${seed.payoutId}`]);
      expect([bill?.state, bill?.needsReviewReason, bill?.grossPence]).toEqual([
        "needs_review",
        "accounting_parked_payout_lines_unmapped",
        NET - 500,
      ]);
    });

    it("parks the payment of a payout paid outside Stripe; the bill still goes", async () => {
      await aim("bid", "dry_run");
      const seed = await seedBidPayout(owner);
      await markBidPaid(owner, seed.payoutId, false);
      await projection(true).project(event("payout.paid", seed.payoutId));
      await drain("dry_run", createZohoBooksDryRunAdapter({ orgs: testOrgConfigs() }), {});
      const docs = await docsOf(bidRefs(seed));
      expect(docs.map((d) => [d.kind, d.state, d.needsReviewReason])).toEqual([
        ["contact", "issued", null],
        ["bill", "issued", null],
        ["bill_payment", "needs_review", "accounting_parked_payout_paid_outside_stripe"],
      ]);
    });

    it("refuses, for a person, a payment whose payout's figures changed after its bill was registered", async () => {
      await aim("bid", "dry_run");
      const seed = await seedBidPayout(owner);
      await projection(true).project(event("payout.settlement_created", seed.payoutId));
      await owner.execute(sql`insert into payout_line (payout_id, amount, kind, created_by_user_id, note)
        select ${seed.payoutId}, '-1.00', 'adjustment', created_by_user_id, 'Fixture'
          from legal_entity where id = ${seed.sellerId}`);
      await owner.execute(sql`update payout set gross_amount = gross_amount - 1, net_amount = net_amount - 1
        where id = ${seed.payoutId}`);
      await markBidPaid(owner, seed.payoutId);
      await expect(projection(true).project(event("payout.paid", seed.payoutId))).rejects.toThrow(
        /accounting_projection_refused/,
      );
      const docs = await docsOf(bidRefs(seed));
      expect(docs.map((d) => [d.kind, d.grossPence])).toEqual([
        ["contact", 0],
        ["bill", NET],
      ]);
    });

    it("books a Shop artist payout: the row's net, paid from clearing; parked until answered", async () => {
      await aim("shop", "dry_run");
      const parked = await seedShopPayout(owner);
      const paidEvent = (id: string) =>
        event("shop.payout.paid", id, { schemaVersion: 1, payoutId: id, paidReference: "x" });
      expect(await projection().project(paidEvent(parked.payoutId))).toMatchObject({
        created: 3,
        parked: 2,
      });
      const answered = await seedShopPayout(owner);
      expect(await projection(true).project(paidEvent(answered.payoutId))).toMatchObject({
        created: 3,
        parked: 0,
      });
      await drain("dry_run", createZohoBooksDryRunAdapter({ orgs: testOrgConfigs() }), {});
      const docs = await docsOf([
        `LAX-SHOP-CON-vendor-${answered.artistParty}`,
        `LAX-SHOP-BILL-${answered.payoutId}`,
        `LAX-SHOP-BPAY-${answered.payoutId}`,
      ]);
      expect(docs.map((d) => [d.kind, d.legalEntity, d.state, d.grossPence])).toEqual([
        ["contact", "london_art_exchange", "issued", 0],
        ["bill", "london_art_exchange", "issued", 31_500],
        ["bill_payment", "london_art_exchange", "issued", 31_500],
      ]);
      const [held] = await docsOf([`LAX-SHOP-BILL-${parked.payoutId}`]);
      expect(held?.needsReviewReason).toBe("accounting_parked_artist_payout_treatment");
      // Marked paid by staff: the payment is parked, never sent.
      const byHand = await seedShopPayout(owner, { throughStripe: false });
      await projection(true).project(paidEvent(byHand.payoutId));
      const [payment] = await docsOf([`LAX-SHOP-BPAY-${byHand.payoutId}`]);
      expect(payment?.needsReviewReason).toBe("accounting_parked_payout_paid_outside_stripe");
      // LAX's own stock owes no one: nothing is booked.
      const own = await seedShopPayout(owner, { payeeKind: "lax" });
      expect(await projection(true).project(paidEvent(own.payoutId))).toEqual({
        outcome: "skipped",
        reason: "lax_own_stock",
      });
      if (WORKER_URL) {
        const denied = await worker
          .execute(sql`select paid_reference from shop_payout_ledger where id = ${parked.payoutId}`)
          .then(() => null)
          .catch((e: { cause?: { code?: string } }) => e.cause?.code ?? "thrown");
        expect(denied).toBe("42501");
      }
    });

    it("reconciles the day's payouts against their bills and payments to the penny", async () => {
      await aim("bid", "dry_run");
      const store = new DrizzleStripeReconciliationStore(worker);
      const target = { provider: "books", mode: "dry_run" } as const;
      const seed = await seedBidPayout(owner);
      const day = seed.createdAt.toISOString().slice(0, 10);
      // Before anything is projected the payout's bill is missing.
      const before = await store.payoutTotals("london_auction_xchange", day, target);
      expect(before.find((t) => t.kind === "bill")).toMatchObject({
        laxPence: NET,
        laxCount: 1,
        unmatchedCount: 1,
      });
      await projection(true).project(event("payout.settlement_created", seed.payoutId));
      await drain("dry_run", createZohoBooksDryRunAdapter({ orgs: testOrgConfigs() }), {});
      const after = await store.payoutTotals("london_auction_xchange", day, target);
      expect(after.find((t) => t.kind === "bill")).toMatchObject({
        laxPence: NET,
        laxCount: 1,
        booksPence: NET,
        booksCount: 1,
        unmatchedCount: 0,
      });
      // A ledger that changed after the bill: the bill no longer matches the payout.
      await owner.execute(sql`update payout set gross_amount = gross_amount - 1, net_amount = net_amount - 1
        where id = ${seed.payoutId}`);
      const changed = await store.payoutTotals("london_auction_xchange", day, target);
      expect(changed.find((t) => t.kind === "bill")).toMatchObject({
        laxPence: NET - 100,
        booksPence: NET,
        unmatchedCount: 1,
      });
      const [doc] = await owner
        .select({ id: accountingDocument.id })
        .from(accountingDocument)
        .where(
          and(
            eq(accountingDocument.laxReference, `LAX-BID-BILL-${seed.payoutId}`),
            eq(accountingDocument.targetMode, "dry_run"),
          ),
        );
      expect(doc).toBeDefined();
    });
  },
);
