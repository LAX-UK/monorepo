import { randomUUID } from "node:crypto";
import { createZohoBooksDryRunAdapter } from "@auction/accounting-zoho-books";
import { testOrgConfigs } from "@auction/accounting-zoho-books/testing";
import { closeDb, createDb } from "@auction/db";
import { accountingDocument, accountingStripeBalanceTxn } from "@auction/db/schema";
import { createAccountingRepositories } from "@auction/persistence/repositories";
import { and, asc, eq, like, sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { holdAccountingTablesLock } from "../../testing/accounting-tables-lock.js";
import { FakeStripeBalance, stripeTxn } from "../../testing/fake-stripe-balance.js";
import { ACCOUNTING_ALERTS } from "./accounting-alerts.js";
import type { SenderPorts } from "./accounting-dispatch.js";
import { AccountingSender } from "./accounting-sender.service.js";
import { StripeBooksSync, startOfLondonDay } from "./stripe-books-sync.service.js";
import { RECONCILIATION_PREFIX, StripeReconciliation } from "./stripe-reconciliation.service.js";

const OWNER_URL = process.env.DATABASE_URL;
const WORKER_URL = process.env.DATABASE_URL_WORKER;
const HAS_DB = Boolean(OWNER_URL);
const log = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

/** A day of its own per run (the ledger is append-only and shared), years after other fixtures. */
const RUN = randomUUID().replace(/-/g, "").slice(0, 10);
const DAY_OFFSET = Number.parseInt(RUN.slice(0, 6), 16) % 3_000;
const DAY = new Date(Date.UTC(2041, 0, 1 + DAY_OFFSET)).toISOString().slice(0, 10);
const NEXT_DAY = new Date(Date.UTC(2041, 0, 2 + DAY_OFFSET)).toISOString().slice(0, 10);
const PREVIOUS_DAY = new Date(Date.UTC(2041, 0, DAY_OFFSET)).toISOString().slice(0, 10);
/** Noon on DAY, London (UTC in January; British Summer Time shifts it by an hour, still DAY). */
const NOON = startOfLondonDay(DAY).getTime() / 1000 + 12 * 3600;
/** The job runs at 05:30 the next morning. */
const RUN_AT = new Date(startOfLondonDay(NEXT_DAY).getTime() + 5.5 * 3_600_000);

let accounts = 0;
const id = (kind: string, n: number) => `${kind}_${RUN}${String(n).padStart(4, "0")}`;

holdAccountingTablesLock({ beforeAll, afterAll });

describe.skipIf(!HAS_DB)(
  "Stripe fees and payouts to Books (integration)",
  { timeout: 120_000 },
  () => {
    // biome-ignore lint/style/noNonNullAssertion: gated by HAS_DB
    const owner = createDb(OWNER_URL!);
    const worker = createDb(WORKER_URL || (OWNER_URL as string));
    /** A second worker process: its own pool, its own connections. */
    const worker2 = createDb(WORKER_URL || (OWNER_URL as string));
    const repos = createAccountingRepositories(worker, { now: () => RUN_AT });
    const repos2 = createAccountingRepositories(worker2, { now: () => RUN_AT });
    let paidIntent: string;

    /**
     * The engineer's row from the runbook, one account per case (each has its own cursor): which
     * product the account's own movements are, and the balance Books clearing opened with.
     */
    async function account(product: "shop" | "bid"): Promise<string> {
      accounts += 1;
      const accountId = `acct_${product === "shop" ? "S" : "B"}${RUN}${accounts}`;
      await owner.execute(sql`
      insert into accounting_stripe_account (stripe_account_id, product, opening_balance_pence, opening_on)
      values (${accountId}, ${product}, 0, ${PREVIOUS_DAY})`);
      return accountId;
    }

    beforeAll(async () => {
      // A paid Shop order holding the PaymentIntent its card charge was taken under.
      paidIntent = `pi_${RUN}`;
      await owner.execute(sql`
      insert into shop_order (identity_subject_id, fulfilment, merchandise_subtotal_pence,
                              fulfilment_surcharge_pence, total_pence, idempotency_key,
                              stripe_payment_intent_id)
      values (${`stripe-books-${RUN}`}, 'uk_insured_delivery', 10000, 0, 10000, ${`stripe-books-${RUN}`},
              ${paidIntent})`);
    });

    afterAll(async () => {
      await owner.execute(sql`
      update accounting_source_setting
         set xero_mode = case product when 'bid' then 'live' else 'off' end, books_mode = 'off'`);
      await closeDb(owner);
      await closeDb(worker);
      await closeDb(worker2);
    });

    beforeEach(async () => {
      await owner.execute(sql`
      update accounting_document
         set state = 'cancelled', lease_token = null, lease_expires_at = null, settles_at = null
       where state in ('pending', 'sending', 'failed', 'unknown')`);
      await owner.execute(sql`
      update accounting_source_setting
         set xero_mode = 'off', books_mode = case product when 'bid' then 'off' else 'dry_run' end`);
      log.warn.mockClear();
    });

    const charge = (n: number, fee: number, created = NOON + n) =>
      stripeTxn({
        id: id("txn", n),
        created,
        fee,
        source: { id: id("ch", n), chargeId: id("ch", n), paymentIntentId: paidIntent },
      });

    function sync(stripe: FakeStripeBalance, r = repos, pageSize = 100) {
      return new StripeBooksSync({
        ledger: r.stripeLedger,
        settings: r.settingReader,
        readers: [stripe],
        now: () => RUN_AT,
        log,
        pageSize,
      });
    }

    function sender() {
      let n = 0;
      return new AccountingSender({
        workQueue: repos.workQueue,
        dueWork: repos.dueWork,
        transitions: repos.transitions,
        settings: repos.settingReader,
        portsByMode: {
          dry_run: createZohoBooksDryRunAdapter({ orgs: testOrgConfigs() }) as SenderPorts,
        },
        destinations: {},
        transientErrorPrefixes: [],
        newLeaseToken: () => `lease-${randomUUID()}-${++n}`,
        log,
      });
    }

    const ledgerRows = (account: string) =>
      worker
        .select()
        .from(accountingStripeBalanceTxn)
        .where(eq(accountingStripeBalanceTxn.stripeAccountId, account))
        .orderBy(asc(accountingStripeBalanceTxn.balanceTransactionId));

    const documentsFor = (prefix: string) =>
      worker
        .select()
        .from(accountingDocument)
        .where(like(accountingDocument.laxReference, `${prefix}%`))
        .orderBy(asc(accountingDocument.laxReference));

    it("reads every page from the stored cursor, resumes after a dropped connection, and books each fee once", async () => {
      const SHOP_ACCOUNT = await account("shop");
      const stripe = new FakeStripeBalance(SHOP_ACCOUNT);
      // 230 card charges on DAY: three pages of 100.
      for (let n = 1; n <= 230; n += 1) stripe.add(charge(n, 100 + n));
      stripe.failAfterPages(2);
      expect(await sync(stripe).run()).toMatchObject({ failedAccounts: 1, read: 0 });
      // Nothing of the failed window was decided: the cursor did not pass it.
      expect(await ledgerRows(SHOP_ACCOUNT)).toHaveLength(0);

      const summary = await sync(stripe).run();
      expect(summary).toMatchObject({ read: 230, recorded: 230, booked: 230, parked: 0 });
      const rows = await ledgerRows(SHOP_ACCOUNT);
      expect(rows).toHaveLength(230);
      // To the penny: each fee as Stripe took it, nothing of the charge itself.
      const expenses = await documentsFor(`LAX-SHOP-EXP-txn_${RUN.toLowerCase()}`);
      expect(expenses).toHaveLength(230);
      expect(expenses.reduce((sum, d) => sum + d.grossPence, 0)).toBe(
        Array.from({ length: 230 }, (_, i) => 100 + i + 1).reduce((a, b) => a + b, 0),
      );
      expect(expenses.every((d) => d.vatPence === 0 && d.targetMode === "dry_run")).toBe(true);

      // The next run starts where this one stopped: nothing read twice, nothing booked twice.
      const before = stripe.calls.length;
      const again = await sync(stripe).run();
      expect(again).toMatchObject({ read: 0, recorded: 0 });
      for (const call of stripe.calls.slice(before)) {
        expect(call.createdGte).toBeGreaterThanOrEqual((RUN_AT.getTime() - 10 * 60_000) / 1000 - 1);
      }
    });

    it("parks a transaction the ledger refuses as unrecognised, and books the rest of its page", async () => {
      const SHOP_ACCOUNT = await account("shop");
      const stripe = new FakeStripeBalance(SHOP_ACCOUNT);
      // A payout whose source is not a payout id: its row breaks the ledger's CHECK.
      const poison = stripeTxn({
        id: id("txn", 8_502),
        type: "payout",
        amount: -5_000,
        fee: 0,
        created: NOON + 2,
        source: { id: id("tr", 2), chargeId: null, paymentIntentId: null },
      });
      stripe.add(charge(8_501, 101), poison, charge(8_503, 103));
      const summary = await sync(stripe, repos, 2).run();
      expect(summary).toMatchObject({
        read: 3,
        recorded: 3,
        booked: 2,
        parked: 1,
        failedAccounts: 0,
      });
      const rows = await ledgerRows(SHOP_ACCOUNT);
      expect(rows.map((r) => [r.outcome, r.parkReason, r.payoutId])).toEqual([
        ["booked", null, null],
        ["parked", "unrecognised", null],
        ["booked", null, null],
      ]);
      expect(await documentsFor(`LAX-SHOP-TRF-tr_${RUN.toLowerCase()}`)).toHaveLength(0);
      expect(log.warn).toHaveBeenCalledWith(
        expect.objectContaining({ id: id("txn", 8_502) }),
        "accounting_stripe_transaction_parked_instead",
      );
      // The cursor moved past it: the next run reads nothing again.
      expect(await sync(stripe).run()).toMatchObject({ read: 0 });
    });

    it("parks, never reports booked, a fee whose document a rollback cancelled", async () => {
      const before = await account("shop");
      expect(
        await sync(new FakeStripeBalance(before).add(charge(8_601, 111, NOON + 8_601))).run(),
      ).toMatchObject({ booked: 1 });
      // What 0385_rollback.sql leaves: the document cancelled, the ledger gone (here, a new
      // account row with no ledger rows reads the same transaction again).
      const reference = `LAX-SHOP-EXP-${id("txn", 8_601).toLowerCase()}`;
      await owner.execute(sql`
      update accounting_document set state = 'cancelled' where lax_reference = ${reference}`);
      const after = await account("shop");
      const summary = await sync(
        new FakeStripeBalance(after).add(charge(8_601, 111, NOON + 8_601)),
      ).run();
      expect(summary).toMatchObject({ booked: 0, parked: 1 });
      expect((await ledgerRows(after)).map((r) => [r.outcome, r.parkReason])).toEqual([
        ["parked", "was_cancelled"],
      ]);
      expect((await documentsFor(reference)).map((d) => d.state)).toEqual(["cancelled"]);
    });

    it("books nothing twice when two workers run at the same time, in real concurrent transactions", async () => {
      const BID_ACCOUNT = await account("bid");
      const stripe = new FakeStripeBalance(BID_ACCOUNT);
      const stripe2 = new FakeStripeBalance(BID_ACCOUNT);
      for (let n = 1; n <= 60; n += 1) {
        const payout = stripeTxn({
          id: id("txn", 5_000 + n),
          type: "payout",
          amount: -(10_000 + n),
          fee: n % 3 === 0 ? 25 : 0,
          created: NOON + n,
          source: { id: id("po", n), chargeId: null, paymentIntentId: null },
        });
        stripe.add(payout);
        stripe2.add(payout);
      }
      await owner.execute(sql`
      update accounting_source_setting set xero_mode = 'off', books_mode = 'dry_run' where product = 'bid'`);
      const [a, b] = await Promise.all([
        sync(stripe, repos, 7).run(),
        sync(stripe2, repos2, 11).run(),
      ]);
      expect(a.recorded + b.recorded).toBe(60);
      expect(a.alreadyRecorded + b.alreadyRecorded).toBe(60);
      const transfers = await documentsFor(`LAX-BID-TRF-po_${RUN.toLowerCase()}`);
      expect(transfers).toHaveLength(60);
      expect(new Set(transfers.map((d) => d.laxReference)).size).toBe(60);
      expect(transfers.reduce((sum, d) => sum + d.grossPence, 0)).toBe(
        Array.from({ length: 60 }, (_, i) => 10_000 + i + 1).reduce((x, y) => x + y, 0),
      );
      // An instant payout's fee is its own expense, once.
      const fees = await worker
        .select()
        .from(accountingDocument)
        .where(
          and(
            eq(accountingDocument.kind, "expense"),
            like(accountingDocument.laxReference, `LAX-BID-EXP-txn_${RUN.toLowerCase()}%`),
          ),
        );
      expect(fees).toHaveLength(20);
      expect(fees.every((d) => d.grossPence === 25)).toBe(true);
      // One "created" history row per document: nobody registered one twice.
      const history = await owner.execute<{ n: string }>(sql`
      select count(*) as n from accounting_document_event e
        join accounting_document d on d.id = e.document_id
       where d.lax_reference like ${`LAX-BID-%${RUN}%`} and e.action = 'created'`);
      expect(Number(history.rows[0]?.n)).toBe(80);
    });

    it("parks what no stored row attributes, a fee given back and a reversed payout; books a dispute fee", async () => {
      const SHOP_ACCOUNT = await account("shop");
      const BID_ACCOUNT = await account("bid");
      const stripe = new FakeStripeBalance(SHOP_ACCOUNT);
      const base = 7_000;
      stripe.add(
        // A charge LAX never took: no stored row names its PaymentIntent.
        stripeTxn({
          id: id("txn", base + 1),
          created: NOON + 1,
          source: {
            id: id("ch", base + 1),
            chargeId: id("ch", base + 1),
            paymentIntentId: `pi_unknown${RUN}`,
          },
        }),
        // A refund of a LAX charge with no fee: nothing for this job.
        stripeTxn({
          id: id("txn", base + 2),
          type: "refund",
          amount: -2_000,
          fee: 0,
          created: NOON + 2,
          source: { id: id("re", base + 2), chargeId: id("ch", 1), paymentIntentId: paidIntent },
        }),
        // A refund on which Stripe gave its fee back: a person decides.
        stripeTxn({
          id: id("txn", base + 3),
          type: "refund",
          amount: -2_000,
          fee: -30,
          created: NOON + 3,
          source: { id: id("re", base + 3), chargeId: id("ch", 1), paymentIntentId: paidIntent },
        }),
        // A dispute on a LAX charge: its fee is booked, the disputed amount is not.
        stripeTxn({
          id: id("txn", base + 4),
          type: "adjustment",
          amount: -10_000,
          fee: 2_000,
          created: NOON + 4,
          source: { id: id("dp", base + 4), chargeId: id("ch", 1), paymentIntentId: paidIntent },
        }),
        // A payout that failed and came back.
        stripeTxn({
          id: id("txn", base + 5),
          type: "payout_failure",
          amount: 9_000,
          fee: 0,
          created: NOON + 5,
          source: { id: id("po", base + 5), chargeId: null, paymentIntentId: null },
        }),
      );
      // The Shop's PaymentIntent seen in Bid's account: two companies, never guessed.
      const bid = new FakeStripeBalance(BID_ACCOUNT).add(charge(base + 6, 99, NOON + 6));
      await sync(stripe).run();
      await owner.execute(sql`
      update accounting_source_setting set xero_mode = 'off', books_mode = 'dry_run' where product = 'bid'`);
      await sync(bid).run();
      const rows = new Map(
        [...(await ledgerRows(SHOP_ACCOUNT)), ...(await ledgerRows(BID_ACCOUNT))].map((r) => [
          r.balanceTransactionId,
          r,
        ]),
      );
      expect(rows.get(id("txn", base + 1))).toMatchObject({
        outcome: "parked",
        parkReason: "unattributable",
        product: null,
      });
      expect(rows.get(id("txn", base + 2))).toMatchObject({
        outcome: "nothing",
        bookedFeePence: 0,
      });
      expect(rows.get(id("txn", base + 3))).toMatchObject({
        outcome: "parked",
        parkReason: "fee_refund",
      });
      expect(rows.get(id("txn", base + 4))).toMatchObject({
        outcome: "booked",
        bookedFeePence: 2_000,
        bookedPayoutPence: 0,
      });
      expect(rows.get(id("txn", base + 5))).toMatchObject({
        outcome: "parked",
        parkReason: "payout_reversed",
      });
      expect(rows.get(id("txn", base + 6))).toMatchObject({
        outcome: "parked",
        parkReason: "attribution_conflict",
      });
      // Only the dispute fee became a document.
      const references = (await documentsFor("LAX-")).map((d) => d.laxReference);
      for (const n of [1, 2, 3, 5, 6]) {
        expect(references.some((r) => r.endsWith(id("txn", base + n).toLowerCase()))).toBe(false);
      }
    });

    it("records a fee but books nothing while Books is not aimed at the product", async () => {
      const SHOP_ACCOUNT = await account("shop");
      await owner.execute(sql`
      update accounting_source_setting
         set xero_mode = case product when 'bid' then 'live' else 'off' end, books_mode = 'off'`);
      const stripe = new FakeStripeBalance(SHOP_ACCOUNT).add(charge(8_001, 150, NOON + 8_001));
      await sync(stripe).run();
      const row = (await ledgerRows(SHOP_ACCOUNT)).find(
        (r) => r.balanceTransactionId === id("txn", 8_001),
      );
      expect(row).toMatchObject({ outcome: "not_aimed", product: "shop", bookedFeePence: 0 });
      expect(await documentsFor(`LAX-SHOP-EXP-${id("txn", 8_001).toLowerCase()}`)).toHaveLength(0);
    });

    it("sends the documents through the dry-run sender, then reports the day privately and alerts on a mismatch", async () => {
      // A day of its own, so the cases above (whose queued documents each case cancels) stay out.
      const day = NEXT_DAY;
      const noon = startOfLondonDay(day).getTime() / 1000 + 12 * 3600;
      const runAt = new Date(startOfLondonDay(day).getTime() + 29.5 * 3_600_000);
      const SHOP_ACCOUNT = await account("shop");
      const stripe = new FakeStripeBalance(SHOP_ACCOUNT, 0);
      for (let n = 1; n <= 3; n += 1) stripe.add(charge(9_100 + n, 150 + n, noon + n));
      stripe.add(
        stripeTxn({
          id: id("txn", 9_200),
          type: "payout",
          amount: -12_345,
          fee: 0,
          created: noon + 10,
          source: { id: id("po", 9_200), chargeId: null, paymentIntentId: null },
        }),
      );
      await new StripeBooksSync({
        ledger: repos.stripeLedger,
        settings: repos.settingReader,
        readers: [stripe],
        now: () => runAt,
        log,
      }).run();
      // Everything booked for the day goes to Books (rehearsed).
      const s = sender();
      for (let i = 0; i < 200; i += 1) {
        await s.tick();
        const waiting = await owner.execute<{ n: string }>(sql`
        select count(*) as n from accounting_document
         where lax_reference like ${`%${RUN}%`} and state in ('pending', 'sending')`);
        if (Number(waiting.rows[0]?.n) === 0) break;
      }
      const raised: unknown[] = [];
      const putObject = vi.fn(async () => ({}));
      const report = () =>
        new StripeReconciliation({
          store: repos.reconciliation,
          settings: repos.settingReader,
          readers: [stripe],
          storage: { putObject },
          alerts: { raise: (alert, fields) => void raised.push({ alert, fields }) },
          now: () => runAt,
          log,
        });
      const [shop] = await report().run(day);
      expect(shop?.legalEntity).toBe("london_art_exchange");
      expect(shop?.byType.find((t) => t.kind === "expense")).toMatchObject({
        laxPence: 151 + 152 + 153,
        booksPence: 151 + 152 + 153,
        laxCount: 3,
        booksCount: 3,
        differencePence: 0,
      });
      expect(shop?.byType.find((t) => t.kind === "transfer")).toMatchObject({
        laxPence: 12_345,
        booksPence: 12_345,
        differencePence: 0,
      });
      expect(shop?.parked).toEqual([]);
      expect(shop?.mismatches).toBe(0);
      expect(raised).toEqual([]);
      // Stored under the private reconciliation prefix, as JSON with ids and amounts only, and
      // recorded.
      const [key, body, type] = putObject.mock.calls[0] as unknown as [string, Buffer, string];
      expect(key.startsWith(`${RECONCILIATION_PREFIX}/london_art_exchange/${day}/`)).toBe(true);
      expect(type).toBe("application/json");
      expect(body.toString("utf8")).not.toMatch(/@|name|email/i);
      const stored = await owner.execute<{ storage_key: string; mismatches: number }>(sql`
      select storage_key, mismatches from accounting_reconciliation_report
       where legal_entity = 'london_art_exchange' and report_day = ${day}`);
      expect(stored.rows[0]).toEqual({ storage_key: key, mismatches: 0 });

      // A fee LAX booked that Books does not hold (its document lost, say) is a difference to the
      // penny, and the accounting alert is raised with the stored report's key.
      await owner.execute(sql`
      insert into accounting_stripe_balance_txn
        (stripe_account_id, balance_transaction_id, type, currency, amount_pence, fee_pence,
         created_at_stripe, created_on, product, outcome, booked_fee_pence, read_at)
      values (${SHOP_ACCOUNT}, ${id("txn", 9_300)}, 'charge', 'gbp', 5000, 77,
              ${new Date(noon * 1000)}, ${day}, 'shop', 'booked', 77, now())`);
      const [after] = await report().run(day);
      expect(after?.byType.find((t) => t.kind === "expense")?.differencePence).toBe(77);
      expect(after?.mismatches).toBe(1);
      const secondKey = (putObject.mock.calls[1] as unknown as [string])[0];
      expect(raised).toEqual([
        {
          alert: ACCOUNTING_ALERTS.reconciliationMismatch,
          fields: { legalEntity: "london_art_exchange", day, mismatches: 1, storageKey: secondKey },
        },
      ]);
    });

    it("refuses to change or remove a decided balance transaction, whoever asks", async () => {
      const mine = sql`balance_transaction_id like ${`txn_${RUN}%`}`;
      await expect(
        worker.execute(sql`update accounting_stripe_balance_txn set fee_pence = 0 where ${mine}`),
      ).rejects.toThrow();
      const refused = await owner
        .execute(sql`delete from accounting_stripe_balance_txn where ${mine}`)
        .then(() => null)
        .catch((error: { cause?: { message?: string } }) => error.cause?.message ?? "");
      expect(refused).toMatch(/append-only/);
    });
  },
);
