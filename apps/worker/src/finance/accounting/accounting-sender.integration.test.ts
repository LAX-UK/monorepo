import {
  type AccountingDocument,
  type BidPaymentFacts,
  type Contact,
  type DestinationBinding,
  type IssueOutcome,
  type Payment,
  SETTLE_GRACE_MS,
  WRITE_MARGIN_MS,
  type WriteFence,
  expectedTotals,
  projectBidPaymentCaptured,
} from "@auction/accounting-domain";
import { BID_ORG_ID, InMemoryAccounting } from "@auction/accounting-zoho-books/testing";
import { closeDb, createDb } from "@auction/db";
import { createAccountingRepositories } from "@auction/persistence/repositories";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { holdAccountingTablesLock } from "../../testing/accounting-tables-lock.js";
import type { SenderPorts } from "./accounting-dispatch.js";
import { AccountingSender, SENDER_LEASE_MS } from "./accounting-sender.service.js";

const OWNER_URL = process.env.DATABASE_URL;
const WORKER_URL = process.env.DATABASE_URL_WORKER;
const HAS_DB = Boolean(OWNER_URL);

const BOUND: DestinationBinding = { test_org: { bid: BID_ORG_ID } };
const log = { info: vi.fn(), warn: vi.fn() };

/** A fresh Bid payment each time, so cases never share a LAX reference. */
function bidDocuments(): readonly AccountingDocument[] {
  const id = () => crypto.randomUUID();
  const facts: BidPaymentFacts = {
    paymentId: id(),
    amountPence: 12_000,
    currency: "GBP",
    capturedOn: "2031-03-02",
    invoice: {
      invoiceId: id(),
      buyer: { legalEntityId: id(), name: "Ada Collector", email: "ada@example.com" },
      raisedOn: "2031-03-01",
      dueOn: "2031-03-15",
      lines: [{ kind: "hammer", label: "Hammer price", amountPence: 12_000 }],
    },
  };
  const projected = projectBidPaymentCaptured(facts);
  if (!projected.ok) throw new Error(projected.refusal.message);
  return projected.value.documents;
}

/** The fake as a rehearsal adapter: it reaches no organisation, as the dry run does. */
function rehearsing(ports: SenderPorts, overrides: Partial<SenderPorts> = {}): SenderPorts {
  return {
    invoices: ports.invoices,
    payments: ports.payments,
    creditNotes: ports.creditNotes,
    bills: ports.bills,
    contacts: ports.contacts,
    lookup: ports.lookup,
    destination: { destinationFor: () => ({ kind: "none" }) },
    ...overrides,
  };
}

holdAccountingTablesLock({ beforeAll, afterAll });

/** The sender over the real accounting tables, as `worker_app` when that role is configured. */
describe.skipIf(!HAS_DB)("accounting sender (integration)", { timeout: 60_000 }, () => {
  // biome-ignore lint/style/noNonNullAssertion: gated by HAS_DB
  const owner = createDb(OWNER_URL!);
  const worker = createDb(WORKER_URL || (OWNER_URL as string));
  // Later than anything an earlier run left behind, so its rows are never in the way.
  let nowMs = Date.now();
  const repos = createAccountingRepositories(worker, { now: () => new Date(nowMs) });

  afterAll(async () => {
    await owner.execute(sql`
      update accounting_source_setting
         set xero_mode = case product when 'bid' then 'live' else 'off' end, books_mode = 'off'`);
    await closeDb(owner);
    await closeDb(worker);
  });

  beforeEach(async () => {
    // Nothing left to claim, look up or requeue from an earlier case or suite: a failed or unknown
    // row would otherwise be settled by a later case's tick and interfere with it.
    await owner.execute(sql`
      update accounting_document
         set state = 'cancelled', lease_token = null, lease_expires_at = null, settles_at = null
       where state in ('pending', 'sending', 'failed', 'unknown')`);
  });

  async function aimBooks(mode: "dry_run" | "test_org") {
    await owner.execute(sql`
      update accounting_source_setting set xero_mode = 'off', books_mode = ${mode}`);
  }

  function senderFor(
    portsByMode: Partial<Record<"dry_run" | "test_org", SenderPorts>>,
    destinations: DestinationBinding = BOUND,
  ) {
    let n = 0;
    return new AccountingSender({
      workQueue: repos.workQueue,
      dueWork: repos.dueWork,
      transitions: repos.transitions,
      settings: repos.settingReader,
      portsByMode,
      destinations,
      transientErrorPrefixes: [],
      newLeaseToken: () => `lease-${crypto.randomUUID()}-${++n}`,
      log,
    });
  }

  async function queue(documents: readonly AccountingDocument[]) {
    for (const document of documents) {
      const r = await repos.registry.register({ document, sourceEventRef: "domain_event:it" });
      if (!r.ok) throw new Error(r.refusal.message);
    }
  }

  async function stored(reference: string, mode: "dry_run" | "test_org") {
    const found = await repos.lookup.findByReference("bid", reference, { provider: "books", mode });
    return found.ok ? found.value?.record : undefined;
  }

  it("keeps a payment Books read back different, answered after its lease, with a person and never resends it", async () => {
    await aimBooks("dry_run");
    const documents = bidDocuments();
    const payment = documents[2] as Payment;
    const fake = new InMemoryAccounting();
    const recordPayment = vi.fn(async (p: Payment): Promise<IssueOutcome> => {
      nowMs += SENDER_LEASE_MS + 1;
      return {
        status: "differs",
        reason: "zoho_books_payment_mismatch",
        number: "PMT-000042",
        providerId: "7000000000042",
        pdfRef: null,
        totals: expectedTotals(p),
      };
    });
    const sender = senderFor({ dry_run: rehearsing(fake, { payments: { recordPayment } }) });
    // One at a time, so they are claimed in order (rows created at one instant go in id order):
    // an invoice claimed before its contact is refused, and its payment then waits for it.
    for (const document of documents) {
      await queue([document]);
      nowMs += 1;
    }
    await sender.tick();
    const held = {
      status: "needs_review",
      lookup: "clear",
      issued: { number: "PMT-000042", providerId: "7000000000042" },
      reason: "provider document differs from ours: zoho_books_payment_mismatch",
    };
    expect(await stored(payment.reference, "dry_run")).toMatchObject(held);

    nowMs += SENDER_LEASE_MS + SETTLE_GRACE_MS + 24 * 60 * 60_000;
    await sender.tick();
    expect(await stored(payment.reference, "dry_run")).toMatchObject(held);
    expect(recordPayment).toHaveBeenCalledTimes(1);
  });

  /**
   * Books makes the payment and reads it back different, but the answer does not reach the record
   * on its lease (`after` decides how). The lookup after the settle time must still leave it with
   * a person, Books' id kept, and never send it again.
   */
  async function differingPaymentWhoseAnswerIsLost(
    after: (answer: IssueOutcome) => Promise<IssueOutcome>,
  ) {
    await aimBooks("dry_run");
    const documents = bidDocuments();
    const payment = documents[2] as Payment;
    const fake = new InMemoryAccounting();
    const recordPayment = vi.fn(async (p: Payment): Promise<IssueOutcome> => {
      fake.faults.inject("read_back_differs");
      return after(await fake.payments.recordPayment(p));
    });
    const sender = senderFor({ dry_run: rehearsing(fake, { payments: { recordPayment } }) });
    // One at a time, so they are claimed in order (rows created at one instant go in id order).
    for (const document of documents) {
      await queue([document]);
      nowMs += 1;
    }
    await sender.tick();
    expect((await stored(payment.reference, "dry_run"))?.status).toBe("unknown");

    nowMs += SENDER_LEASE_MS + SETTLE_GRACE_MS + 60 * 60_000;
    await sender.tick();
    const held = {
      status: "needs_review",
      lookup: "clear",
      issued: { providerId: expect.any(String) },
      reason: "provider document differs from ours: zoho_books_payment_mismatch",
    };
    expect(await stored(payment.reference, "dry_run")).toMatchObject(held);
    nowMs += 24 * 60 * 60_000;
    await sender.tick();
    expect(await stored(payment.reference, "dry_run")).toMatchObject(held);
    expect(recordPayment).toHaveBeenCalledTimes(1);
  }

  it("a differing payment whose lease was swept mid-send ends with a person, never issued", async () => {
    await differingPaymentWhoseAnswerIsLost(async (answer) => {
      nowMs += SENDER_LEASE_MS + 1;
      // Another worker's claim sweeps the lapsed lease: the record becomes unknown.
      await repos.workQueue.claimNext({
        provider: "books",
        leaseToken: `other-${crypto.randomUUID()}`,
        leaseMs: SENDER_LEASE_MS,
        targetModes: ["test_org"],
      });
      return answer;
    });
  });

  it("a differing payment whose answer was lost ends with a person, never issued", async () => {
    await differingPaymentWhoseAnswerIsLost(async () => ({ status: "unknown", detail: "timeout" }));
  });

  it("holds a lease only for its token, while sending, with the margin still to run", async () => {
    await aimBooks("dry_run");
    const [contact] = bidDocuments();
    await queue([contact as AccountingDocument]);
    const token = `lease-${crypto.randomUUID()}`;
    const claimed = await repos.workQueue.claimNext({
      provider: "books",
      leaseToken: token,
      leaseMs: SENDER_LEASE_MS,
      targetModes: ["dry_run"],
    });
    const id = claimed.ok && claimed.value ? claimed.value.id : "";
    expect(await repos.workQueue.holdsLease(id, token, WRITE_MARGIN_MS)).toBe(true);
    expect(await repos.workQueue.holdsLease(id, "someone-else", WRITE_MARGIN_MS)).toBe(false);
    nowMs += SENDER_LEASE_MS - WRITE_MARGIN_MS;
    expect(await repos.workQueue.holdsLease(id, token, WRITE_MARGIN_MS)).toBe(false);
    expect(await repos.workQueue.holdsLease(id, token, 0)).toBe(true);
    nowMs += WRITE_MARGIN_MS;
    // Swept by the next claim: unknown, so the lease is no longer held at all.
    await repos.workQueue.claimNext({
      provider: "books",
      leaseToken: `other-${crypto.randomUUID()}`,
      leaseMs: SENDER_LEASE_MS,
      targetModes: ["test_org"],
    });
    expect((await stored(contact?.reference as string, "dry_run"))?.status).toBe("unknown");
    expect(await repos.workQueue.holdsLease(id, token, 0)).toBe(false);
  });

  it("starts no create after its lease was swept; the next holder finds nothing and sends once", async () => {
    await aimBooks("dry_run");
    const [contact] = bidDocuments();
    const fake = new InMemoryAccounting();
    const upsertContact = vi.fn(async (c: Contact, fence?: WriteFence) => {
      if (upsertContact.mock.calls.length === 1) {
        nowMs += SENDER_LEASE_MS + 1;
        await repos.workQueue.claimNext({
          provider: "books",
          leaseToken: `other-${crypto.randomUUID()}`,
          leaseMs: SENDER_LEASE_MS,
          targetModes: ["test_org"],
        });
      }
      return fake.contacts.upsertContact(c, fence);
    });
    const sender = senderFor({ dry_run: rehearsing(fake, { contacts: { upsertContact } }) });
    await queue([contact as AccountingDocument]);
    await sender.tick();
    expect((await fake.lookup.findDocument(contact as AccountingDocument)).status).toBe(
      "not_found",
    );
    nowMs += SETTLE_GRACE_MS + 60 * 60_000;
    await sender.tick();
    expect((await stored(contact?.reference as string, "dry_run"))?.status).toBe("issued");
    expect(upsertContact).toHaveBeenCalledTimes(2);
  });

  it("never sends a dry run document through an adapter that names a Books organisation", async () => {
    await aimBooks("dry_run");
    const [contact] = bidDocuments();
    const books = new InMemoryAccounting();
    const upsert = vi.spyOn(books.contacts, "upsertContact");
    await queue([contact as AccountingDocument]);
    await senderFor({ dry_run: books }).tick();
    expect(upsert).not.toHaveBeenCalled();
    expect(await stored(contact?.reference as string, "dry_run")).toMatchObject({
      status: "needs_review",
      lookup: "clear",
      issued: null,
      reason: expect.stringMatching(/^rehearsal_reaches_organisation: /),
    });
    // Held in one step, recorded as an escalation from sending: it was never failed.
    const history = await owner.execute(sql`
      select e.action, e.from_state, e.to_state, e.detail
        from accounting_document_event e
        join accounting_document d on d.id = e.document_id
       where d.lax_reference = ${contact?.reference as string} and d.target_mode = 'dry_run'
       order by e.id`);
    expect(history.rows.map((r) => [r.action, r.from_state, r.to_state])).toEqual([
      ["created", null, "pending"],
      ["start_sending", "pending", "sending"],
      ["escalate", "sending", "needs_review"],
    ]);
    expect(history.rows.at(-1)?.detail).toMatchObject({ unsent: true });
  });

  it("refuses a test_org document bound to another organisation, and sends one bound to its own", async () => {
    await aimBooks("test_org");
    const [refused] = bidDocuments();
    const books = new InMemoryAccounting();
    const upsert = vi.spyOn(books.contacts, "upsertContact");
    await queue([refused as AccountingDocument]);
    await senderFor({ test_org: books }, { test_org: { bid: "9000000000777" } }).tick();
    expect(upsert).not.toHaveBeenCalled();
    expect(await stored(refused?.reference as string, "test_org")).toMatchObject({
      status: "needs_review",
      issued: null,
      reason: expect.stringMatching(/^destination_mismatch: /),
    });

    const [sent] = bidDocuments();
    await queue([sent as AccountingDocument]);
    await senderFor({ test_org: books }).tick();
    expect((await stored(sent?.reference as string, "test_org"))?.status).toBe("issued");
    expect(upsert).toHaveBeenCalledTimes(1);
  });
});
