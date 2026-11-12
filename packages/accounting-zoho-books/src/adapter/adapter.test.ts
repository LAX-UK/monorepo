import {
  buildContact,
  buildCreditNoteFor,
  buildInvoice,
  buildPayment,
} from "@auction/accounting-domain";
import { describe, expect, it } from "vitest";
import {
  type ZohoBooksError,
  ZohoNotFoundError,
  ZohoValidationError,
  zohoFail,
  zohoOk,
} from "../errors.js";
import {
  type AdapterHarness,
  DUPLICATE_ZOHO_CODE,
  STANDARD_TAX_ID,
  createAdapterHarness,
  rawOrgSettings,
} from "../testing/index.js";
import type { ZohoApi } from "./api.js";
import { createZohoBooksAdapter } from "./index.js";
import { lineItemBody } from "./mappers/common.js";
import { parseOrgConfigs } from "./org-config.js";

type Json = Record<string, unknown>;

const unwrap = <T>(r: { ok: true; value: T } | { ok: false; refusal: { code: string } }): T => {
  if (!r.ok) throw new Error(r.refusal.code);
  return r.value;
};

const buyer = unwrap(
  buildContact({
    product: "shop",
    sourceId: "buyer-1",
    name: "Test Buyer",
    email: "buyer@example.test",
  }),
);
const invoice = unwrap(
  buildInvoice({
    product: "shop",
    sourceId: "inv-1",
    contactReference: buyer.reference,
    issuedOn: "2026-11-12",
    dueOn: "2026-11-26",
    lines: [
      {
        description: "Print, edition 1/50",
        quantity: 1,
        unitNetPence: 10_000,
        treatment: "standard",
        role: "goods",
      },
      {
        description: "Delivery",
        quantity: 1,
        unitNetPence: 1_500,
        treatment: "zero",
        role: "delivery",
      },
    ],
  }),
);

function bodiesTo(h: AdapterHarness, method: string, pathPart: string): Json[] {
  return h.books.requests
    .filter((r) => r.method === method && new URL(r.url).pathname.includes(pathPart))
    .map((r) => JSON.parse(r.body ?? "{}") as Json);
}

describe("request bodies", () => {
  it("sends an invoice with quantity 1, two-decimal rates, a tax id per treatment and the LAX reference", async () => {
    const h = await createAdapterHarness();
    await h.settle(h.ports.contacts.upsertContact(buyer));
    await h.settle(h.ports.invoices.issueInvoice(invoice));
    const [body] = bodiesTo(h, "POST", "/invoices");
    const customer = (h.books.stored("london_art_exchange", "contact")[0] as Json).contact_id;
    expect(body).toEqual({
      customer_id: customer,
      reference_number: invoice.reference,
      date: "2026-11-12",
      due_date: "2026-11-26",
      currency_code: "GBP",
      is_inclusive_tax: false,
      line_items: [
        {
          item_id: "9200000000010",
          account_id: "9200000000011",
          description: "Print, edition 1/50",
          quantity: 1,
          rate: 100,
          tax_id: STANDARD_TAX_ID,
        },
        {
          item_id: "9200000000012",
          account_id: "9200000000013",
          description: "Delivery",
          quantity: 1,
          rate: 15,
          tax_id: "9100000000002",
        },
      ],
      custom_fields: [{ customfield_id: "9200000000001", value: invoice.reference }],
      template_id: "9200000000040",
      autonumbergenerationgroup_id: "9200000000050",
    });
  });

  it("sends a credit note tax inclusive, the gross as the rate, and names the invoice in the query", async () => {
    const h = await createAdapterHarness();
    await h.settle(h.ports.contacts.upsertContact(buyer));
    await h.settle(h.ports.invoices.issueInvoice(invoice));
    const note = unwrap(
      buildCreditNoteFor(invoice, {
        sourceId: "cn-1",
        issuedOn: "2026-11-13",
        buckets: {
          paidGoodsPence: 12_000,
          paidDeliveryPence: 1_500,
          refundedGoodsPence: 0,
          refundedDeliveryPence: 0,
        },
        request: { goodsPence: 6_000, deliveryPence: 0 },
        priorCredits: [],
      }),
    );
    await h.settle(h.ports.creditNotes.issueCreditNote(note));
    const request = h.books.requests.find(
      (r) => r.method === "POST" && r.url.includes("/creditnotes"),
    );
    const url = new URL(request?.url ?? "");
    const invoiceId = (h.books.stored("london_art_exchange", "invoice")[0] as Json).invoice_id;
    expect(url.searchParams.get("invoice_id")).toBe(invoiceId);
    const body = JSON.parse(request?.body ?? "{}") as Json;
    expect(body.is_inclusive_tax).toBe(true);
    expect(body.line_items).toEqual([
      {
        item_id: "9200000000010",
        account_id: "9200000000011",
        description: "Credit: Print, edition 1/50",
        quantity: 1,
        rate: 60,
        tax_id: STANDARD_TAX_ID,
      },
    ]);
  });

  it("sends a payment into the clearing account with one applied amount per invoice", async () => {
    const h = await createAdapterHarness();
    await h.settle(h.ports.contacts.upsertContact(buyer));
    await h.settle(h.ports.invoices.issueInvoice(invoice));
    const payment = unwrap(
      buildPayment({
        product: "shop",
        sourceId: "pay-1",
        contactReference: buyer.reference,
        receivedOn: "2026-11-12",
        amountPence: 13_500,
        allocations: [{ invoiceReference: invoice.reference, amountPence: 13_500 }],
      }),
    );
    await h.settle(h.ports.payments.recordPayment(payment));
    const [body] = bodiesTo(h, "POST", "/customerpayments");
    const invoiceId = (h.books.stored("london_art_exchange", "invoice")[0] as Json).invoice_id;
    expect(body?.account_id).toBe("9200000000020");
    expect(body?.payment_mode).toBe("Stripe");
    expect(body?.amount).toBe(135);
    expect(body?.invoices).toEqual([{ invoice_id: invoiceId, amount_applied: 135 }]);
  });

  it("updates an existing contact with its name only", async () => {
    const h = await createAdapterHarness();
    await h.settle(h.ports.contacts.upsertContact(buyer));
    await h.settle(h.ports.contacts.upsertContact({ ...buyer, name: "Renamed" }));
    const [update] = bodiesTo(h, "PUT", "/contacts/");
    expect(update).toEqual({ contact_name: "Renamed" });
  });

  it("never sends an adjustment, and only ever talks to the EU Books host", async () => {
    const h = await createAdapterHarness();
    await h.settle(h.ports.contacts.upsertContact(buyer));
    await h.settle(h.ports.invoices.issueInvoice(invoice));
    for (const request of h.books.requests) {
      expect(new URL(request.url).hostname).toBe("books.zoho.eu");
      expect(request.body ?? "").not.toContain("adjustment");
    }
  });

  it("refuses a line that carries VAT when no tax id is configured for its treatment", () => {
    const org = parseOrgConfigs(rawOrgSettings()).london_art_exchange;
    if (!org) throw new Error("fixture");
    const standard = invoice.lines[0];
    if (!standard) throw new Error("fixture");
    const result = lineItemBody(standard, { ...org, taxIds: { ...org.taxIds, standard: null } });
    expect(result.ok).toBe(false);
  });
});

/** An API whose replies the test scripts, for the shapes the simulator never produces. */
function scripted(
  handlers: Partial<Record<"get" | "post" | "put", (path: string, query?: unknown) => unknown>>,
): ZohoApi {
  const reply =
    (kind: "get" | "post" | "put") =>
    async (_org: string, path: string, ...rest: unknown[]) => {
      const handler = handlers[kind];
      if (!handler) throw new Error(`unscripted ${kind} ${path}`);
      const out = handler(path, rest.at(-1));
      return out instanceof Error
        ? zohoFail(out as ZohoBooksError)
        : zohoOk({ status: 200, body: out });
    };
  return { get: reply("get"), post: reply("post"), put: reply("put") } as unknown as ZohoApi;
}

const shopOnly = () => {
  const raw = rawOrgSettings();
  return parseOrgConfigs({ london_art_exchange: raw.london_art_exchange });
};

describe("lookup guards", () => {
  const lookup = (api: ZohoApi) => createZohoBooksAdapter({ api, orgs: shopOnly() }).lookup;

  it("is not believed when the document read back carries another reference", async () => {
    const api = scripted({
      get: (path) =>
        path === "/invoices"
          ? { code: 0, invoices: [{ invoice_id: "1" }] }
          : {
              code: 0,
              invoice: {
                invoice_id: "1",
                invoice_number: "INV-1",
                sub_total: 1,
                tax_total: 0,
                total: 1,
                custom_field_hash: { cf_lax_reference: "LAX-SHOP-INV-other" },
              },
            },
    });
    const out = await lookup(api).findByReference("shop", "invoice", invoice.reference);
    expect(out).toEqual({ status: "unavailable", reason: "zoho_books_reference_not_confirmed" });
  });

  it("reports ambiguous when two documents carry the reference", async () => {
    const api = scripted({
      get: () => ({ code: 0, invoices: [{ invoice_id: "1" }, { invoice_id: "2" }] }),
    });
    expect(await lookup(api).findByReference("shop", "invoice", invoice.reference)).toEqual({
      status: "ambiguous",
      count: 2,
    });
  });

  it("only reads absence from an empty search or a 404, never from a failure", async () => {
    const empty = scripted({ get: () => ({ code: 0, invoices: [] }) });
    expect((await lookup(empty).findByReference("shop", "invoice", invoice.reference)).status).toBe(
      "not_found",
    );
    const server = scripted({ get: () => new ZohoValidationError({ code: "invalid_request" }) });
    expect(
      (await lookup(server).findByReference("shop", "invoice", invoice.reference)).status,
    ).toBe("unavailable");
    const notFound = scripted({ get: () => new ZohoNotFoundError({ code: "not_found" }) });
    expect(
      (await lookup(notFound).findByReference("shop", "invoice", invoice.reference)).status,
    ).toBe("not_found");
  });

  it("is unavailable for an unreadable list, a reference of another kind, or an organisation not set up", async () => {
    const garbled = scripted({ get: () => ({ code: 0, nope: true }) });
    expect(
      (await lookup(garbled).findByReference("shop", "invoice", invoice.reference)).status,
    ).toBe("unavailable");
    const api = scripted({});
    expect((await lookup(api).findByReference("shop", "payment", invoice.reference)).status).toBe(
      "unavailable",
    );
    expect((await lookup(api).findByReference("bid", "contact", "LAX-BID-CON-x")).status).toBe(
      "unavailable",
    );
  });
});

describe("create guards", () => {
  const found = { code: 0, contacts: [{ contact_id: "1" }] };
  const contactDetail = {
    code: 0,
    contact: {
      contact_id: "1",
      contact_name: "x",
      custom_field_hash: { cf_lax_reference: buyer.reference },
    },
  };

  it("an unreadable success reply is unknown, because Books may have made the document", async () => {
    const api = scripted({
      get: () => ({ code: 0, contacts: [] }),
      post: () => ({ code: 0, message: "ok" }),
    });
    const out = await createZohoBooksAdapter({ api, orgs: shopOnly() }).contacts.upsertContact(
      buyer,
    );
    expect(out).toEqual({ status: "unknown", detail: "zoho_books_unreadable_document" });
  });

  it("an amount that is not whole pence is unknown, never rounded", async () => {
    const api = scripted({
      get: () => ({ code: 0, contacts: [] }),
      post: () => ({ code: 0, contact: { contact_id: "9" } }),
    });
    const ports = createZohoBooksAdapter({ api, orgs: shopOnly() });
    expect((await ports.contacts.upsertContact(buyer)).status).toBe("issued");
    const priced = scripted({
      get: (path) => (path === "/contacts" ? found : contactDetail),
      post: () => ({
        code: 0,
        invoice: {
          invoice_id: "5",
          invoice_number: "INV-5",
          sub_total: 100.005,
          tax_total: 20,
          total: 120.005,
        },
      }),
    });
    const out = await createZohoBooksAdapter({
      api: priced,
      orgs: shopOnly(),
    }).invoices.issueInvoice(invoice);
    expect(out.status).toBe("unknown");
  });

  it("a duplicate refusal with nothing found behind it stays a rejection", async () => {
    const api = scripted({
      get: () => ({ code: 0, contacts: [] }),
      post: () =>
        new ZohoValidationError({
          code: "rejected_by_zoho",
          httpStatus: 400,
          zohoCode: DUPLICATE_ZOHO_CODE,
        }),
    });
    const out = await createZohoBooksAdapter({ api, orgs: shopOnly() }).contacts.upsertContact(
      buyer,
    );
    expect(out.status).toBe("rejected");
  });

  it("a document for an organisation that is not set up is rejected before anything is sent", async () => {
    const api = scripted({});
    const bidContact = unwrap(buildContact({ product: "bid", sourceId: "b1", name: "Bidder" }));
    const out = await createZohoBooksAdapter({ api, orgs: shopOnly() }).contacts.upsertContact(
      bidContact,
    );
    expect(out).toEqual({ status: "rejected", reason: "zoho_books_organisation_not_configured" });
  });

  it("an unconfirmed dependency lookup is unknown, a missing one is rejected", async () => {
    const down = scripted({ get: () => new ZohoValidationError({ code: "invalid_request" }) });
    const a = await createZohoBooksAdapter({ api: down, orgs: shopOnly() }).invoices.issueInvoice(
      invoice,
    );
    expect(a.status).toBe("unknown");
    const none = scripted({ get: () => ({ code: 0, contacts: [] }) });
    const b = await createZohoBooksAdapter({ api: none, orgs: shopOnly() }).invoices.issueInvoice(
      invoice,
    );
    expect(b).toEqual({ status: "rejected", reason: "zoho_books_contact_missing" });
  });
});
