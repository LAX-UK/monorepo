import { randomUUID } from "node:crypto";
import {
  type AccountingDocument,
  type CreditNote,
  type Invoice,
  type Result,
  buildContact,
  buildCreditNoteFor,
  buildInvoice,
} from "@auction/accounting-domain";
import { closeDb, createDb } from "@auction/db";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createAccountingRepositories } from "./create-accounting-repositories.js";

const OWNER_URL = process.env.DATABASE_URL;
const WORKER_URL = process.env.DATABASE_URL_WORKER;
const API_URL = process.env.DATABASE_URL_API;
const HAS_DB = Boolean(OWNER_URL);
const clock = { now: () => new Date() };

function must<T, C extends string>(result: Result<T, C>): T {
  if (!result.ok) throw new Error(`${result.refusal.code}: ${result.refusal.message}`);
  return result.value;
}

const newId = () => randomUUID().replaceAll("-", "").slice(0, 16);

/** A Bid invoice of £100 (margin scheme, no VAT) to one buyer, with its contact. */
function invoiceWithContact(): { contact: AccountingDocument; invoice: Invoice } {
  const buyer = newId();
  const contact = must(
    buildContact({ product: "bid", sourceId: buyer, name: "Fixture buyer", email: null }),
  );
  const invoice = must(
    buildInvoice({
      product: "bid",
      sourceId: newId(),
      contactReference: contact.reference,
      issuedOn: "2031-03-01",
      dueOn: "2031-03-15",
      lines: [
        {
          description: "Hammer price",
          quantity: 1,
          unitNetPence: 10_000,
          treatment: "margin_scheme",
          role: "goods",
        },
      ],
    }),
  );
  return { contact, invoice };
}

function credit(
  invoice: Invoice,
  pence: number,
  prior: readonly CreditNote[] = [],
  refund = true,
  sourceId: string = newId(),
): CreditNote {
  const credited = prior.reduce((sum, c) => sum + c.totals.grossPence, 0);
  return must(
    buildCreditNoteFor(invoice, {
      sourceId,
      issuedOn: "2031-03-05",
      buckets: {
        paidGoodsPence: invoice.totals.grossPence,
        paidDeliveryPence: 0,
        refundedGoodsPence: credited,
        refundedDeliveryPence: 0,
      },
      request: { goodsPence: pence, deliveryPence: 0 },
      priorCredits: prior,
      ...(refund
        ? { refund: { account: "stripe_clearing" as const, refundedOn: "2031-03-05" } }
        : {}),
    }),
  );
}

describe.skipIf(!HAS_DB)("accounting credit notes (integration)", { timeout: 60_000 }, () => {
  // biome-ignore lint/style/noNonNullAssertion: gated by HAS_DB
  const owner = createDb(OWNER_URL!);
  // As the worker role when it is configured, so the grants are exercised too.
  const worker = createDb(WORKER_URL || (OWNER_URL as string));
  const api = createDb(API_URL || (OWNER_URL as string));
  const repos = createAccountingRepositories(worker, clock);

  beforeAll(async () => {
    await owner.execute(sql`
      insert into accounting_source_setting (product, xero_mode, books_mode) values
        ('bid', 'off', 'dry_run'), ('shop', 'off', 'off'), ('lax_art', 'off', 'off')
      on conflict (product) do update
        set xero_mode = excluded.xero_mode, books_mode = excluded.books_mode`);
  });
  const run = randomUUID().slice(0, 8);
  const buyer = `cn-buyer-${run}`;
  const entity = randomUUID();

  /** A captured payment of £100 with one refund row of `pence`: the refund id (a credit note's source). */
  async function refundRow(pence: number): Promise<{ paymentId: string; refundId: string }> {
    const lotId = randomUUID();
    const paymentId = randomUUID();
    const refundId = randomUUID();
    await owner.execute(sql`
      insert into lot (id, seller_legal_entity_id, title, auction_type, starting_price,
         current_price, start_time, end_time, status, winner_id, buyer_legal_entity_id)
      values (${lotId}, ${entity}, ${`Credit lot ${lotId.slice(0, 6)}`}, 'english', 100, 100,
         now() - interval '40 days', now() - interval '20 days', 'ended', ${buyer}, ${entity})`);
    await owner.execute(sql`
      insert into payment (id, lot_id, buyer_id, buyer_legal_entity_id, seller_legal_entity_id,
         amount, platform_fee, status)
      values (${paymentId}, ${lotId}, ${buyer}, ${entity}, ${entity}, 100.00, 0, 'captured'::payment_status)`);
    await owner.execute(sql`
      insert into payment_refund (id, payment_id, idempotency_key, amount_pence, currency, source,
         stripe_refund_id)
      values (${refundId}, ${paymentId}, ${`cn-${refundId}`}, ${pence}, 'GBP', 'staff',
         ${`re_cn_${refundId}`})`);
    return { paymentId, refundId };
  }

  beforeAll(async () => {
    const now = new Date();
    await owner.execute(sql`
      insert into "user" (id, name, email, email_verified, created_at, updated_at)
      values (${buyer}, 'B', ${`${buyer}@integration.test`}, true, ${now}, ${now})`);
    await owner.execute(sql`
      insert into legal_entity (id, display_name, kind, subkind, created_by_user_id, status)
      values (${entity}, 'Credit entity', 'individual', 'private_collector', ${buyer}, 'approved')`);
  });

  beforeEach(async () => {
    await owner.execute(sql`
      update accounting_document
         set state = 'cancelled', lease_token = null, lease_expires_at = null, settles_at = null
       where state in ('pending', 'sending', 'failed', 'unknown')`);
  });
  afterAll(async () => {
    await owner.execute(sql`
      update accounting_source_setting
         set xero_mode = case product when 'bid' then 'live' else 'off' end, books_mode = 'off'`);
    await closeDb(owner);
    await closeDb(worker);
    await closeDb(api);
  });

  async function register(document: AccountingDocument) {
    return must(await repos.registry.register({ document, sourceEventRef: `evt-${newId()}` }));
  }

  async function issue(id: string) {
    await owner.execute(sql`
      update accounting_document
         set state = 'issued', provider = 'books', attempts = 1,
             lease_token = null, lease_expires_at = null,
             provider_id = ${`bk-${newId()}`}, provider_number = 'DRY-RUN'
       where id = ${id}`);
  }

  async function claim() {
    return must(
      await repos.workQueue.claimNext({
        provider: "books",
        targetModes: ["dry_run"],
        leaseToken: `lease-${newId()}`,
        leaseMs: 60_000,
      }),
    );
  }

  it("a credit note is not handed out until the invoice it credits is issued in the same books", async () => {
    const { contact, invoice } = invoiceWithContact();
    const contactRow = (await register(contact)).stored;
    await issue(contactRow.id);
    const invoiceRow = (await register(invoice)).stored;
    const note = credit(invoice, 2_500);
    const noteRow = (await register(note)).stored;
    // Make the credit note the oldest: it would be claimed first if it did not wait.
    await owner.execute(
      sql`update accounting_document set created_at = created_at - interval '1 hour' where id = ${noteRow.id}`,
    );
    const first = await claim();
    expect(first?.id).toBe(invoiceRow.id);
    expect(await claim()).toBeNull();
    await issue(invoiceRow.id);
    expect((await claim())?.id).toBe(noteRow.id);
  });

  it("a credit note for an invoice not registered in these books is refused", async () => {
    const { invoice } = invoiceWithContact();
    const out = await repos.registry.register({
      document: credit(invoice, 100),
      sourceEventRef: "evt-orphan",
    });
    expect(out).toMatchObject({ ok: false, refusal: { code: "credit_without_invoice" } });
  });

  it("concurrent registrations never credit more than the invoice; a replay still passes", async () => {
    const { contact, invoice } = invoiceWithContact();
    await register(contact);
    await register(invoice);
    const first = credit(invoice, 6_000);
    await register(first);
    // Four more, each 4,000 on top of 6,000: only one fits in the 10,000 invoice.
    const rivals = Array.from({ length: 4 }, () => credit(invoice, 4_000, [first]));
    const outcomes = await Promise.all(
      rivals.map((document) => repos.registry.register({ document, sourceEventRef: "evt-race" })),
    );
    expect(outcomes.filter((o) => o.ok)).toHaveLength(1);
    expect(
      outcomes.filter((o) => !o.ok && o.refusal.code === "credit_exceeds_invoice"),
    ).toHaveLength(3);
    // The first one again is a replay, not counted against itself.
    expect(
      must(await repos.registry.register({ document: first, sourceEventRef: "evt-again" })),
    ).toMatchObject({
      created: false,
    });
    const notes = must(
      await repos.creditNotes.creditNotesFor("bid", invoice.reference, {
        provider: "books",
        mode: "dry_run",
      }),
    );
    expect(notes.reduce((sum, n) => sum + n.totals.grossPence, 0)).toBe(10_000);
    expect(notes[0]?.reference).toBe(first.reference);
  });

  it("a cancelled credit note frees its amount; a credit note's refund must be from Stripe clearing", async () => {
    const { contact, invoice } = invoiceWithContact();
    await register(contact);
    await register(invoice);
    const whole = credit(invoice, 10_000);
    const row = (await register(whole)).stored;
    must(await repos.transitions.apply(row.id, { action: "cancel" }));
    await register(credit(invoice, 10_000));
    const forged = {
      ...credit(invoice, 1),
      refund: { account: "petty_cash", refundedOn: "2031-03-05" },
    };
    expect(
      await repos.registry.register({
        document: forged as unknown as CreditNote,
        sourceEventRef: "evt-forged",
      }),
    ).toMatchObject({ ok: false, refusal: { code: "bad_document" } });
  });

  it("the refund step is listed once issued, settled once by concurrent workers, then never listed again", async () => {
    const { contact, invoice } = invoiceWithContact();
    await issue((await register(contact)).stored.id);
    await issue((await register(invoice)).stored.id);
    const { refundId } = await refundRow(3_000);
    const money = (await register(credit(invoice, 3_000, [], true, refundId))).stored;
    const cancellation = (await register(credit(invoice, 1_000, [], false))).stored;
    expect(
      (await repos.creditNoteRefunds.listDue(["dry_run"], 500)).due.map((d) => d.creditNote.id),
    ).not.toContain(money.id);
    await issue(money.id);
    await issue(cancellation.id);
    const listed = (await repos.creditNoteRefunds.listDue(["dry_run"], 500)).due.map(
      (d) => d.creditNote.id,
    );
    expect(listed).toContain(money.id);
    // A credit note that gives no money back is never refunded.
    expect(listed).not.toContain(cancellation.id);
    let steps = 0;
    const settled = await Promise.all(
      Array.from({ length: 6 }, () =>
        repos.creditNoteRefunds.settleExclusively(money.id, async () => {
          steps += 1;
          await new Promise((resolve) => setTimeout(resolve, 50));
          return {
            outcome: "refunded",
            amountPence: 3_000,
            account: "stripe_clearing",
            rehearsal: true,
          };
        }),
      ),
    );
    expect(settled.filter((r) => r === "settled")).toHaveLength(1);
    expect(steps).toBe(1);
    // Settled: a later worker that reaches it does not run the step again.
    expect(
      await repos.creditNoteRefunds.settleExclusively(money.id, async () => {
        steps += 1;
        return {
          outcome: "refunded",
          amountPence: 3_000,
          account: "stripe_clearing",
          rehearsal: true,
        };
      }),
    ).toBe("skipped");
    expect(steps).toBe(1);
    const history = await owner.execute<{ n: number }>(sql`
      select count(*)::int as n from accounting_document_event
       where document_id = ${money.id} and action = 'refund_credit_note'`);
    expect(history.rows[0]?.n).toBe(1);
    expect(
      (await repos.creditNoteRefunds.listDue(["dry_run"], 500)).due.map((d) => d.creditNote.id),
    ).not.toContain(money.id);
  });

  it("the refund step reads the refund itself again under the lock (review N1): one taken back, or one it cannot find, is held and never run", async () => {
    const { contact, invoice } = invoiceWithContact();
    await issue((await register(contact)).stored.id);
    await issue((await register(invoice)).stored.id);
    const { paymentId, refundId } = await refundRow(2_000);
    const reversed = (await register(credit(invoice, 2_000, [], true, refundId))).stored;
    const stranger = (await register(credit(invoice, 1_000))).stored;
    await issue(reversed.id);
    await issue(stranger.id);
    await owner.execute(sql`
      insert into payment_refund (payment_id, idempotency_key, amount_pence, currency, source,
         stripe_refund_id)
      values (${paymentId}, ${`cn-rv-${refundId}`}, -2000, 'GBP', 'refund_reversal',
         ${`re_cn_${refundId}`})`);
    let steps = 0;
    const step = async () => {
      steps += 1;
      return {
        outcome: "refunded" as const,
        amountPence: 2_000,
        account: "stripe_clearing" as const,
        rehearsal: true,
      };
    };
    expect(await repos.creditNoteRefunds.settleExclusively(reversed.id, step)).toBe(
      "refund_reversed",
    );
    expect(await repos.creditNoteRefunds.settleExclusively(stranger.id, step)).toBe(
      "refund_reversed",
    );
    expect(steps).toBe(0);
    const rows = await owner.execute<{ state: string; reason: string | null; refunds: number }>(sql`
      select d.state, d.needs_review_reason as reason,
             (select count(*)::int from accounting_document_event e
               where e.document_id = d.id and e.action = 'refund_credit_note') as refunds
        from accounting_document d where d.id in (${reversed.id}, ${stranger.id})`);
    expect(rows.rows).toEqual([
      { state: "needs_review", reason: "accounting_refund_reversed_after_credit", refunds: 0 },
      { state: "needs_review", reason: "accounting_refund_reversed_after_credit", refunds: 0 },
    ]);
    // Held: not listed again, and the step is never run for them.
    const listed = (await repos.creditNoteRefunds.listDue(["dry_run"], 500)).due.map(
      (d) => d.creditNote.id,
    );
    expect(listed).not.toContain(reversed.id);
    expect(await repos.creditNoteRefunds.settleExclusively(reversed.id, step)).toBe("skipped");
    expect(steps).toBe(0);
  });

  it("api_app cannot write refund history; the worker cannot rewrite it", async () => {
    const { contact, invoice } = invoiceWithContact();
    await register(contact);
    const row = (await register(invoice)).stored;
    if (API_URL) {
      await expect(
        api.execute(sql`
          insert into accounting_document_event (document_id, action, from_state, to_state, attempts, detail, occurred_at)
          values (${row.id}, 'refund_credit_note', 'issued', 'issued', 0, '{}'::jsonb, now())`),
      ).rejects.toThrow();
    }
    if (WORKER_URL) {
      await expect(
        worker.execute(
          sql`update accounting_document_event set action = 'refund_credit_note' where document_id = ${row.id}`,
        ),
      ).rejects.toThrow();
    }
  });

  it("a Bid credit note with a live copy is never listed for the invoice email (MI)", async () => {
    const { contact, invoice } = invoiceWithContact();
    await issue((await register(contact)).stored.id);
    const invoiceRow = (await register(invoice)).stored;
    await issue(invoiceRow.id);
    const noteRow = (await register(credit(invoice, 2_500))).stored;
    await issue(noteRow.id);
    const ids = [invoiceRow.id, noteRow.id];
    // Both issued live with a copy that is not a rehearsal: what the email is sent for.
    await owner.execute(sql`
      update accounting_document set target_mode = 'live', provider_number = 'LIVE-1'
       where id in (${invoiceRow.id}, ${noteRow.id})`);
    for (const id of ids) {
      await owner.execute(sql`
        insert into accounting_document_copy (document_id, storage_key, byte_size, sha256, rehearsal)
        values (${id}, ${`fixture/${id}.pdf`}, 100, ${"a".repeat(64)}, false)`);
    }
    try {
      const listed = await repos.copies.listEmailDue(1_000, ["bid"]);
      // The invoice beside it is listed, so the credit note is left out by kind, not by setup.
      expect(listed.due.map((d) => d.documentId)).toContain(invoiceRow.id);
      expect(listed.due.map((d) => d.documentId)).not.toContain(noteRow.id);
      expect(listed.unreadable).not.toContain(noteRow.id);
    } finally {
      await owner.execute(sql`
        update accounting_document_copy
           set email_skipped_at = now(), email_skip_reason = 'fixture'
         where document_id in (${invoiceRow.id}, ${noteRow.id})`);
    }
  });
});
