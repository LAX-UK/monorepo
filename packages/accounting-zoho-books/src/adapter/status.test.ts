import {
  type IssuedDocument,
  buildContact,
  buildInvoice,
  buildPayment,
} from "@auction/accounting-domain";
import { describe, expect, it } from "vitest";
import { CallBudgetShare } from "../call-budget.js";
import { ZohoBooksClient } from "../client.js";
import type { BudgetDecision, CallBudget } from "../ports.js";
import { FakeClock } from "../testing/fake-clock.js";
import {
  InMemoryTokenStore,
  RecordingLogger,
  SimulatedBooks,
  TEST_REFRESH_TOKEN,
  createAdapterHarness,
  testConfig,
  testOrgConfigs,
} from "../testing/index.js";
import { ZohoDocumentStatusReader } from "./status.js";

/** A share far larger than any test reads: the share is not what those tests are about. */
const ROOMY = { maxCalls: 100, keepFree: 0 };

const unwrap = <T>(r: { ok: true; value: T } | { ok: false; refusal: { code: string } }): T => {
  if (!r.ok) throw new Error(r.refusal.code);
  return r.value;
};

const buyer = unwrap(
  buildContact({
    product: "shop",
    sourceId: "buyer-1",
    name: "Test Buyer",
    email: "b@example.test",
  }),
);
const invoiceFor = (sourceId: string) =>
  unwrap(
    buildInvoice({
      product: "shop",
      sourceId,
      contactReference: buyer.reference,
      issuedOn: "2026-11-12",
      dueOn: "2026-11-26",
      lines: [
        {
          description: "Print, edition 1/50",
          quantity: 1,
          unitNetPence: 10_000,
          treatment: "outside_scope",
          role: "goods",
        },
      ],
    }),
  );

async function issued(h: Awaited<ReturnType<typeof createAdapterHarness>>, sourceId = "inv-1") {
  await h.settle(h.ports.contacts.upsertContact(buyer));
  const invoice = invoiceFor(sourceId);
  const out = await h.settle(h.ports.invoices.issueInvoice(invoice));
  if (out.status !== "issued") throw new Error(out.status);
  const identity: IssuedDocument = { number: out.number, providerId: out.providerId, pdfRef: null };
  return { invoice, identity };
}

describe("reading an issued document's state back from Books", () => {
  it("reads an invoice as open with its balance, and as paid once LAX's payment is recorded", async () => {
    const h = await createAdapterHarness();
    const { invoice, identity } = await issued(h);

    const first = await h.settle(h.ports.statuses.withinShare(ROOMY).readStatus(invoice, identity));
    expect(first).toEqual({
      status: "read",
      reading: { state: "open", balancePence: 10_000, payments: [] },
    });

    const payment = unwrap(
      buildPayment({
        product: "shop",
        sourceId: "pay-1",
        contactReference: buyer.reference,
        receivedOn: "2026-11-12",
        amountPence: 10_000,
        allocations: [{ invoiceReference: invoice.reference, amountPence: 10_000 }],
      }),
    );
    const paid = await h.settle(h.ports.payments.recordPayment(payment));
    if (paid.status !== "issued") throw new Error(paid.status);
    const second = await h.settle(
      h.ports.statuses.withinShare(ROOMY).readStatus(invoice, identity),
    );
    expect(second).toEqual({
      status: "read",
      reading: {
        state: "paid",
        balancePence: 0,
        payments: [
          {
            providerPaymentId: paid.providerId,
            amountPence: 10_000,
            date: "2026-11-12",
            mode: "Stripe",
            reference: payment.reference,
          },
        ],
      },
    });
  });

  it("sees a void and a payment staff recorded by hand, and never writes to read them", async () => {
    const h = await createAdapterHarness();
    const { invoice, identity } = await issued(h);
    const cheque = h.books.recordPaymentByHand(identity.providerId, {
      amountPence: 4_000,
      date: "2026-11-13",
      mode: "Cheque",
    });
    const before = h.books.requests.length;
    const read = await h.settle(h.ports.statuses.withinShare(ROOMY).readStatus(invoice, identity));
    expect(read).toEqual({
      status: "read",
      reading: {
        state: "partially_paid",
        balancePence: 6_000,
        payments: [
          {
            providerPaymentId: cheque,
            amountPence: 4_000,
            date: "2026-11-13",
            mode: "Cheque",
            reference: null,
          },
        ],
      },
    });
    h.books.setStateByHand(identity.providerId, "void");
    const voided = await h.settle(
      h.ports.statuses.withinShare(ROOMY).readStatus(invoice, identity),
    );
    expect(voided.status === "read" && voided.reading.state).toBe("void");
    const sent = h.books.requests.slice(before);
    expect(sent.map((r) => r.method)).toEqual(["GET", "GET"]);
  });

  it("says not found once staff deleted the document in Books", async () => {
    const h = await createAdapterHarness();
    const { invoice, identity } = await issued(h);
    h.books.deleteByHand("london_art_exchange", identity.providerId);
    expect(
      await h.settle(h.ports.statuses.withinShare(ROOMY).readStatus(invoice, identity)),
    ).toEqual({
      status: "not_found",
    });
  });

  it("refuses to believe a document that does not carry the LAX reference it was sent with", async () => {
    const h = await createAdapterHarness();
    const { identity } = await issued(h, "inv-1");
    const other = invoiceFor("inv-2");
    expect(await h.settle(h.ports.statuses.withinShare(ROOMY).readStatus(other, identity))).toEqual(
      {
        status: "unavailable",
        reason: "zoho_books_reference_not_confirmed",
      },
    );
  });

  it("sends nothing for an id that is not a Books id (a rehearsal id)", async () => {
    const h = await createAdapterHarness();
    const before = h.books.requests.length;
    const out = await h.ports.statuses.withinShare(ROOMY).readStatus(invoiceFor("inv-1"), {
      number: "DRY-RUN",
      providerId: "dry-run:x",
      pdfRef: null,
    });
    expect(out).toEqual({ status: "unavailable", reason: "zoho_books_bad_provider_id" });
    expect(h.books.requests.length).toBe(before);
  });

  it("the dry run reads nothing and answers rehearsal", async () => {
    const h = await createAdapterHarness({ writes: { mode: "dry_run" } });
    const { createZohoBooksDryRunAdapter } = await import("./dry-run.js");
    const dry = createZohoBooksDryRunAdapter({ orgs: h.orgs });
    expect(
      await dry.statuses.withinShare(ROOMY).readStatus(invoiceFor("inv-1"), {
        number: "DRY-RUN",
        providerId: "dry-run:x",
        pdfRef: null,
      }),
    ).toEqual({ status: "rehearsal" });
  });
});

class CountingBudget implements CallBudget {
  used = 0;
  constructor(readonly limit: number) {}
  async consume(): Promise<BudgetDecision> {
    if (this.used >= this.limit) return { allowed: false, used: this.used, limit: this.limit };
    this.used += 1;
    return { allowed: true, used: this.used, limit: this.limit };
  }
}

describe("the status check's share of the daily Books budget", () => {
  it("stops after its own share and leaves the shared budget untouched past it", async () => {
    const shared = new CountingBudget(1_000);
    const share = new CallBudgetShare(shared, { maxCalls: 2, keepFree: 0 });
    expect((await share.consume("org")).allowed).toBe(true);
    expect((await share.consume("org")).allowed).toBe(true);
    expect((await share.consume("org")).allowed).toBe(false);
    expect(shared.used).toBe(2);
  });

  it("refuses once the day's count would leave too little for sending", async () => {
    const shared = new CountingBudget(10);
    shared.used = 7;
    const share = new CallBudgetShare(shared, { maxCalls: 100, keepFree: 2 });
    expect((await share.consume("org")).allowed).toBe(true);
    expect((await share.consume("org")).allowed).toBe(false);
  });

  it("refuses when the shared budget is spent", async () => {
    const shared = new CountingBudget(1);
    shared.used = 1;
    const share = new CallBudgetShare(shared, { maxCalls: 100, keepFree: 0 });
    expect((await share.consume("org")).allowed).toBe(false);
  });

  it("a status read through a client on a spent share is budget_spent, and nothing is sent", async () => {
    const orgs = testOrgConfigs();
    const books = new SimulatedBooks(orgs);
    const clock = new FakeClock();
    const shared = new CountingBudget(1_000);
    const share = new CallBudgetShare(shared, { maxCalls: 0, keepFree: 0 });
    // The client counts against the day's budget; the reader's reads count against its share.
    const client = new ZohoBooksClient({
      config: testConfig(),
      transport: books,
      tokenStore: new InMemoryTokenStore(),
      clock,
      logger: new RecordingLogger(),
      random: () => 0.5,
      budget: shared,
    });
    await client.registerRefreshToken(
      orgs.london_art_exchange?.organizationId as string,
      TEST_REFRESH_TOKEN,
    );
    const reader = new ZohoDocumentStatusReader(client, orgs, share);
    const out = await clock.settle(
      reader.readStatus(invoiceFor("inv-1"), { number: "INV-1", providerId: "123", pdfRef: null }),
    );
    expect(out).toEqual({ status: "budget_spent" });
    expect(books.requests).toEqual([]);
    expect(shared.used).toBe(0);
  });

  it("a reader stops after its own share; each read is counted once in the day's budget; a new share reads again", async () => {
    const h = await createAdapterHarness();
    const { invoice, identity } = await issued(h);
    const org = h.orgs.london_art_exchange?.organizationId as string;
    const reader = h.ports.statuses.withinShare({ maxCalls: 1, keepFree: 0 });

    const usedBefore = (await h.budget.consume(org)).used;
    expect((await h.settle(reader.readStatus(invoice, identity))).status).toBe("read");
    // One read and this probe: the share draws on the client's budget once per call, not twice.
    expect((await h.budget.consume(org)).used).toBe(usedBefore + 2);

    const sent = h.books.requests.length;
    expect(await h.settle(reader.readStatus(invoice, identity))).toEqual({
      status: "budget_spent",
    });
    expect(h.books.requests.length).toBe(sent);

    const tomorrow = h.ports.statuses.withinShare({ maxCalls: 1, keepFree: 0 });
    expect((await h.settle(tomorrow.readStatus(invoice, identity))).status).toBe("read");
  });

  it("a reader sends nothing once the day's count would leave too little for sending", async () => {
    const h = await createAdapterHarness();
    const { invoice, identity } = await issued(h);
    const sent = h.books.requests.length;
    const reader = h.ports.statuses.withinShare({ maxCalls: 100, keepFree: 1_000 });
    expect(await h.settle(reader.readStatus(invoice, identity))).toEqual({
      status: "budget_spent",
    });
    expect(h.books.requests.length).toBe(sent);
  });
});
