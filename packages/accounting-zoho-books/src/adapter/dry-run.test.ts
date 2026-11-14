import {
  type Invoice,
  PRODUCTS,
  buildContact,
  buildInvoice,
  buildPayment,
  expectedTotals,
} from "@auction/accounting-domain";
import { describe, expect, it } from "vitest";
import { ZohoBudgetExhaustedError, ZohoRateLimitedError, ZohoValidationError } from "../errors.js";
import { isTransientRejection } from "../outcome.js";
import { rawOrgSettings, testOrgConfigs } from "../testing/index.js";
import { DRY_RUN_NUMBER, createZohoBooksDryRunAdapter, dryRunProviderId } from "./dry-run.js";
import { parseOrgConfigs } from "./org-config.js";
import { ZOHO_BOOKS_REJECTIONS as R } from "./rejections.js";

const unwrap = <T>(r: { ok: true; value: T } | { ok: false; refusal: { code: string } }): T => {
  if (!r.ok) throw new Error(r.refusal.code);
  return r.value;
};

const contact = (product: "bid" | "shop") =>
  unwrap(buildContact({ product, sourceId: "buyer-1", name: "Test Buyer", email: null }));

const invoice = (product: "bid" | "shop", treatment: "standard" | "margin_scheme"): Invoice =>
  unwrap(
    buildInvoice({
      product,
      sourceId: "inv-1",
      contactReference: contact(product).reference,
      issuedOn: "2026-11-12",
      dueOn: "2026-11-26",
      lines: [
        {
          description: "Hammer price",
          quantity: 1,
          unitNetPence: 123_456,
          treatment,
          role: "goods",
        },
      ],
    }),
  );

describe("Books dry run", () => {
  const ports = createZohoBooksDryRunAdapter({ orgs: testOrgConfigs() });

  it("rehearses applying a payment's remainder, and refuses one naming another product", async () => {
    const application = {
      product: "shop" as const,
      entity: "london_art_exchange" as const,
      paymentReference: "LAX-SHOP-PAY-order-1",
      invoiceReference: "LAX-SHOP-INV-order-1-delivery",
      contactReference: contact("shop").reference,
      amountPence: 4_000,
    };
    expect(await ports.remainders.applyRemainder(application)).toEqual({
      status: "applied",
      rehearsal: true,
    });
    expect(
      await ports.remainders.applyRemainder({
        ...application,
        invoiceReference: "LAX-BID-INV-order-1",
      }),
    ).toEqual({ status: "rejected", reason: R.entityMismatch });
  });

  it("answers a document it could send with a rehearsal identity and our own totals", async () => {
    const doc = invoice("bid", "margin_scheme");
    expect(await ports.invoices.issueInvoice(doc)).toEqual({
      status: "issued",
      number: DRY_RUN_NUMBER,
      providerId: dryRunProviderId(doc.reference),
      pdfRef: null,
      totals: expectedTotals(doc),
    });
    expect((await ports.contacts.upsertContact(contact("bid"))).status).toBe("issued");
    const payment = unwrap(
      buildPayment({
        product: "bid",
        sourceId: "pay-1",
        contactReference: contact("bid").reference,
        receivedOn: "2026-11-13",
        amountPence: 123_456,
        allocations: [{ invoiceReference: doc.reference, amountPence: 123_456 }],
      }),
    );
    expect((await ports.payments.recordPayment(payment)).status).toBe("issued");
  });

  it("refuses with the adapter's own reasons whatever Books mode would refuse", async () => {
    // London Art Exchange is not VAT registered: a standard-rated line is held for staff.
    expect(await ports.invoices.issueInvoice(invoice("shop", "standard"))).toEqual({
      status: "rejected",
      reason: R.vatOnUnregisteredEntity,
    });
    const noBid = createZohoBooksDryRunAdapter({ orgs: testOrgConfigs({ withoutBid: true }) });
    expect(await noBid.invoices.issueInvoice(invoice("bid", "margin_scheme"))).toEqual({
      status: "rejected",
      reason: R.organisationNotConfigured,
    });
    const crossed = {
      ...invoice("bid", "margin_scheme"),
      contactReference: contact("shop").reference,
    };
    expect(await ports.invoices.issueInvoice(crossed)).toEqual({
      status: "rejected",
      reason: R.entityMismatch,
    });
  });

  it("finds nothing on lookup: nothing was ever written", async () => {
    expect(await ports.lookup.findDocument(invoice("bid", "margin_scheme"))).toEqual({
      status: "not_found",
    });
  });
});

describe("Books dry run destination", () => {
  it("reaches no organisation for any product, even when the settings name the live books", () => {
    const raw = rawOrgSettings() as Record<string, Record<string, unknown>>;
    const live = parseOrgConfigs(
      Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, { ...v, environment: "live" }])),
    );
    const dry = createZohoBooksDryRunAdapter({ orgs: live });
    for (const product of PRODUCTS) {
      expect(dry.destination.destinationFor(product)).toEqual({ kind: "none" });
    }
  });
});

describe("transient refusals", () => {
  it("are the rate limit and the spent daily budget, nothing about the document", () => {
    expect(isTransientRejection(new ZohoRateLimitedError({ code: "http_429" }).reason)).toBe(true);
    expect(isTransientRejection(new ZohoBudgetExhaustedError({ code: "daily" }).reason)).toBe(true);
    expect(isTransientRejection(new ZohoValidationError({ code: "rejected_by_zoho" }).reason)).toBe(
      false,
    );
    expect(isTransientRejection(R.vatDiffersFromBooks)).toBe(false);
    expect(isTransientRejection(R.writesDisabled)).toBe(false);
  });
});

describe("dry-run stored copy", () => {
  it("is a one-page PDF that says it is a rehearsal and carries no name", async () => {
    const adapter = createZohoBooksDryRunAdapter({ orgs: testOrgConfigs() });
    const doc = invoice("bid", "margin_scheme");
    const issued = await adapter.invoices.issueInvoice(doc);
    if (issued.status !== "issued") throw new Error(issued.status);
    const pdf = await adapter.pdfs.fetchPdf(doc, issued);
    if (pdf.status !== "fetched") throw new Error(pdf.reason);
    const text = new TextDecoder().decode(pdf.bytes);
    expect(pdf.rehearsal).toBe(true);
    expect(text.startsWith("%PDF-1.4")).toBe(true);
    expect(text.trimEnd().endsWith("%%EOF")).toBe(true);
    expect(text).toContain("REHEARSAL - not a Zoho Books document");
    expect(text).toContain(doc.reference);
    expect(text).toContain(`Number ${DRY_RUN_NUMBER}`);
    expect(text).toContain("Total GBP 1,234.56");
    expect(text).not.toContain("Test Buyer");
  });
});
