import {
  type Bill,
  type Invoice,
  type Line,
  buildBill,
  buildContact,
  buildCreditNoteFor,
  buildInvoice,
  buildPayment,
} from "@auction/accounting-domain";
import { describe, expect, it } from "vitest";
import { ZohoBooksConfigError } from "../config.js";
import {
  type ZohoBooksError,
  ZohoNotFoundError,
  ZohoValidationError,
  zohoFail,
  zohoOk,
} from "../errors.js";
import {
  type AdapterHarness,
  BID_ORG_ID,
  BID_TAX_IDS,
  DUPLICATE_ZOHO_CODE,
  SHOP_ORG_ID,
  SHOP_TAX_IDS,
  createAdapterHarness,
  rawOrgSettings,
  testOrgConfigs,
} from "../testing/index.js";
import type { ZohoApi } from "./api.js";
import { ZOHO_BOOKS_REJECTIONS as R, createZohoBooksAdapter } from "./index.js";
import { billBody } from "./mappers/bill.js";
import { lineItemBodies, lineItemBody } from "./mappers/common.js";
import { paymentBody } from "./mappers/payment.js";
import { parseOrgConfigs } from "./org-config.js";
import { WriteGate } from "./write-gate.js";

type Json = Record<string, unknown>;

const unwrap = <T>(r: { ok: true; value: T } | { ok: false; refusal: { code: string } }): T => {
  if (!r.ok) throw new Error(r.refusal.code);
  return r.value;
};

const person = (product: "shop" | "bid", sourceId = "buyer-1") =>
  unwrap(buildContact({ product, sourceId, name: "Test Buyer", email: "buyer@example.test" }));
const buyer = person("shop");
const bidBuyer = person("bid");

function invoiceFor(
  product: "shop" | "bid",
  treatments: readonly [
    "standard" | "outside_scope" | "zero",
    ...("standard" | "outside_scope" | "zero")[],
  ],
  sourceId = "inv-1",
): Invoice {
  return unwrap(
    buildInvoice({
      product,
      sourceId,
      contactReference: person(product).reference,
      issuedOn: "2026-11-12",
      dueOn: "2026-11-26",
      lines: treatments.map((treatment, i) =>
        i === 0
          ? {
              description: "Print, edition 1/50",
              quantity: 1,
              unitNetPence: 10_000,
              treatment,
              role: "goods" as const,
            }
          : {
              description: "Delivery",
              quantity: 1,
              unitNetPence: 1_500,
              treatment,
              role: "delivery" as const,
            },
      ),
    }),
  );
}
/** A Shop invoice: London Art Exchange is not VAT registered, so its lines carry no VAT. */
const invoice = invoiceFor("shop", ["outside_scope", "outside_scope"]);
/** A Bid invoice, against the test Bid organisation modelled as VAT registered. */
const bidInvoice = invoiceFor("bid", ["standard", "zero"]);

function bodiesTo(h: AdapterHarness, method: string, pathPart: string): Json[] {
  return h.books.requests
    .filter((r) => r.method === method && new URL(r.url).pathname.includes(pathPart))
    .map((r) => JSON.parse(r.body ?? "{}") as Json);
}

const orgsOf = (h: AdapterHarness, from = 0) =>
  new Set(
    h.books.requests.slice(from).map((r) => new URL(r.url).searchParams.get("organization_id")),
  );

describe("request bodies", () => {
  it("sends a VAT invoice with quantity 1, two-decimal rates, the organisation's own tax ids and the LAX reference", async () => {
    const h = await createAdapterHarness();
    await h.settle(h.ports.contacts.upsertContact(bidBuyer));
    await h.settle(h.ports.invoices.issueInvoice(bidInvoice));
    const [body] = bodiesTo(h, "POST", "/invoices");
    const customer = (h.books.stored("london_auction_xchange", "contact")[0] as Json).contact_id;
    expect(body).toEqual({
      customer_id: customer,
      reference_number: bidInvoice.reference,
      date: "2026-11-12",
      due_date: "2026-11-26",
      currency_code: "GBP",
      is_inclusive_tax: false,
      line_items: [
        {
          item_id: "9300000000010",
          account_id: "9300000000011",
          description: "Print, edition 1/50",
          quantity: 1,
          rate: 100,
          tax_id: BID_TAX_IDS.standard,
        },
        {
          item_id: "9300000000012",
          account_id: "9300000000013",
          description: "Delivery",
          quantity: 1,
          rate: 15,
          tax_id: BID_TAX_IDS.zero,
        },
      ],
      custom_fields: [{ customfield_id: "9300000000001", value: bidInvoice.reference }],
      template_id: "9300000000040",
      autonumbergenerationgroup_id: "9300000000050",
    });
  });

  it("sends an invoice for the organisation that is not VAT registered with no tax id at all", async () => {
    const h = await createAdapterHarness();
    await h.settle(h.ports.contacts.upsertContact(buyer));
    await h.settle(h.ports.invoices.issueInvoice(invoice));
    const [body] = bodiesTo(h, "POST", "/invoices");
    const lines = body?.line_items as Json[];
    expect(lines).toHaveLength(2);
    for (const line of lines) expect("tax_id" in line).toBe(false);
    expect(JSON.stringify(h.books.requests.map((r) => r.body))).not.toContain("tax_id");
  });

  it("uses each organisation's own tax ids, never the other's", () => {
    const orgs = testOrgConfigs({ shopVatRegistered: true });
    const shop = orgs.london_art_exchange;
    const bid = orgs.london_auction_xchange;
    if (!shop || !bid) throw new Error("fixture");
    const shopDoc = invoiceFor("shop", ["standard", "zero"]);
    const sent = unwrap(lineItemBodies(shopDoc.lines, "tax_exclusive", shop));
    expect(sent.map((l) => l.tax_id)).toEqual([SHOP_TAX_IDS.standard, SHOP_TAX_IDS.zero]);
    const bidSent = unwrap(lineItemBodies(bidInvoice.lines, "tax_exclusive", bid));
    expect(bidSent.map((l) => l.tax_id)).toEqual([BID_TAX_IDS.standard, BID_TAX_IDS.zero]);
  });

  it("sends a credit note tax inclusive, the gross as the rate, and names the invoice in the query", async () => {
    const h = await createAdapterHarness();
    await h.settle(h.ports.contacts.upsertContact(bidBuyer));
    await h.settle(h.ports.invoices.issueInvoice(bidInvoice));
    const note = unwrap(
      buildCreditNoteFor(bidInvoice, {
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
    const invoiceId = (h.books.stored("london_auction_xchange", "invoice")[0] as Json).invoice_id;
    expect(url.searchParams.get("invoice_id")).toBe(invoiceId);
    const body = JSON.parse(request?.body ?? "{}") as Json;
    expect(body.is_inclusive_tax).toBe(true);
    expect(body.currency_code).toBe("GBP");
    expect(body.line_items).toEqual([
      {
        item_id: "9300000000010",
        account_id: "9300000000011",
        description: "Credit: Print, edition 1/50",
        quantity: 1,
        rate: 60,
        tax_id: BID_TAX_IDS.standard,
      },
    ]);
  });

  it("sends a payment into the clearing account in GBP with one applied amount per invoice", async () => {
    const h = await createAdapterHarness();
    await h.settle(h.ports.contacts.upsertContact(buyer));
    await h.settle(h.ports.invoices.issueInvoice(invoice));
    const payment = unwrap(
      buildPayment({
        product: "shop",
        sourceId: "pay-1",
        contactReference: buyer.reference,
        receivedOn: "2026-11-12",
        amountPence: 11_500,
        allocations: [{ invoiceReference: invoice.reference, amountPence: 11_500 }],
      }),
    );
    const out = await h.settle(h.ports.payments.recordPayment(payment));
    expect(out.status).toBe("issued");
    const [body] = bodiesTo(h, "POST", "/customerpayments");
    const invoiceId = (h.books.stored("london_art_exchange", "invoice")[0] as Json).invoice_id;
    expect(body?.account_id).toBe("9200000000020");
    expect(body?.payment_mode).toBe("Stripe");
    expect(body?.amount).toBe(115);
    expect(body?.currency_code).toBe("GBP");
    expect(body?.date).toBe("2026-11-12");
    expect(body?.invoices).toEqual([{ invoice_id: invoiceId, amount_applied: 115 }]);
  });

  it("sends a bill in GBP to a vendor contact, on the expense account", async () => {
    const h = await createAdapterHarness();
    const seller = person("shop", "seller-1");
    await h.settle(h.ports.vendors.upsertVendor(seller));
    const bill = unwrap(
      buildBill({
        product: "shop",
        sourceId: "bill-1",
        contactReference: seller.reference,
        issuedOn: "2026-11-12",
        dueOn: "2026-11-19",
        lines: [
          {
            description: "Artist payout",
            quantity: 3,
            unitNetPence: 1_001,
            treatment: "outside_scope",
            role: "goods",
          },
        ],
      }),
    );
    expect((await h.settle(h.ports.bills.issueBill(bill))).status).toBe("issued");
    const [contactBody] = bodiesTo(h, "POST", "/contacts");
    expect(contactBody?.contact_type).toBe("vendor");
    expect(contactBody?.custom_fields).toEqual([
      { customfield_id: "9200000000001", value: `${seller.reference}:vendor` },
    ]);
    const [body] = bodiesTo(h, "POST", "/bills");
    const vendor = h.books.stored("london_art_exchange", "contact")[0] as Json;
    expect(vendor.contact_type).toBe("vendor");
    expect(body).toEqual({
      vendor_id: vendor.contact_id,
      bill_number: bill.reference,
      reference_number: bill.reference,
      date: "2026-11-12",
      due_date: "2026-11-19",
      currency_code: "GBP",
      is_inclusive_tax: false,
      line_items: [
        { account_id: "9200000000030", description: "Artist payout", quantity: 1, rate: 30.03 },
      ],
      custom_fields: [{ customfield_id: "9200000000001", value: bill.reference }],
    });
  });

  it("creates customers as customers", async () => {
    const h = await createAdapterHarness();
    await h.settle(h.ports.contacts.upsertContact(buyer));
    const [body] = bodiesTo(h, "POST", "/contacts");
    expect(body?.contact_type).toBe("customer");
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
});

describe("mappers refuse rather than guess", () => {
  const bidOrg = () => {
    const org = testOrgConfigs().london_auction_xchange;
    if (!org) throw new Error("fixture");
    return org;
  };
  const shopOrg = () => {
    const org = testOrgConfigs().london_art_exchange;
    if (!org) throw new Error("fixture");
    return org;
  };
  const standard = bidInvoice.lines[0] as Line;

  it("refuses a line that carries VAT when no tax id is configured for its treatment", () => {
    const org = bidOrg();
    const result = lineItemBody(standard, "tax_exclusive", {
      ...org,
      taxIds: { ...org.taxIds, standard: null },
    });
    expect(result.ok ? null : result.refusal.code).toBe("no_tax_id");
  });

  it("refuses a VAT line for an organisation that is not VAT registered, whatever tax ids it is given", () => {
    const org = shopOrg();
    expect(org.vatRegistered).toBe(false);
    const result = lineItemBody(standard, "tax_exclusive", {
      ...org,
      taxIds: { ...org.taxIds, standard: BID_TAX_IDS.standard },
    });
    expect(result.ok ? null : result.refusal.code).toBe("vat_on_unregistered_entity");
  });

  it("refuses a line whose basis differs from the document's (a gross sent as a net)", () => {
    const result = lineItemBody(standard, "tax_inclusive", bidOrg());
    expect(result.ok ? null : result.refusal.code).toBe("mixed_basis");
  });

  it("refuses a tax-inclusive bill line, through the same line rules as every document", () => {
    const note = unwrap(
      buildCreditNoteFor(bidInvoice, {
        sourceId: "cn-b",
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
    const bill = unwrap(
      buildBill({
        product: "bid",
        sourceId: "bill-x",
        contactReference: bidBuyer.reference,
        issuedOn: "2026-11-12",
        dueOn: "2026-11-19",
        lines: [
          {
            description: "Payout",
            quantity: 1,
            unitNetPence: 100,
            treatment: "standard",
            role: "goods",
          },
        ],
      }),
    );
    const mixed: Bill = { ...bill, lines: note.lines };
    const result = billBody(mixed, "1", bidOrg());
    expect(result.ok ? null : result.refusal.code).toBe("mixed_basis");
  });

  it("refuses a payment allocation whose invoice id was not resolved, instead of sending ''", () => {
    const payment = unwrap(
      buildPayment({
        product: "shop",
        sourceId: "pay-x",
        contactReference: buyer.reference,
        receivedOn: "2026-11-12",
        amountPence: 1_000,
        allocations: [{ invoiceReference: invoice.reference, amountPence: 1_000 }],
      }),
    );
    const result = paymentBody(payment, "1", new Map(), shopOrg());
    expect(result.ok ? null : result.refusal.code).toBe("unresolved_invoice");
  });
});

describe("one organisation per document, before any request", () => {
  it("a Bid document never touches the London Art Exchange organisation", async () => {
    const h = await createAdapterHarness();
    await h.settle(h.ports.contacts.upsertContact(bidBuyer));
    await h.settle(h.ports.invoices.issueInvoice(bidInvoice));
    expect(orgsOf(h)).toEqual(new Set([BID_ORG_ID]));
  });

  it("a Shop document never touches the Bid organisation", async () => {
    const h = await createAdapterHarness();
    await h.settle(h.ports.contacts.upsertContact(buyer));
    await h.settle(h.ports.invoices.issueInvoice(invoice));
    expect(orgsOf(h)).toEqual(new Set([SHOP_ORG_ID]));
  });

  it("an entity that disagrees with the product, or a contact of another product, sends nothing", async () => {
    const h = await createAdapterHarness();
    await h.settle(h.ports.contacts.upsertContact(bidBuyer));
    await h.settle(h.ports.contacts.upsertContact(buyer));
    const before = h.books.requests.length;
    const cases: Invoice[] = [
      { ...bidInvoice, entity: "london_art_exchange" },
      { ...invoice, entity: "london_auction_xchange" },
      { ...bidInvoice, contactReference: buyer.reference },
      { ...invoice, contactReference: bidBuyer.reference },
    ];
    for (const doc of cases) {
      expect(await h.settle(h.ports.invoices.issueInvoice(doc))).toEqual({
        status: "rejected",
        reason: R.entityMismatch,
      });
    }
    expect(
      await h.settle(
        h.ports.contacts.upsertContact({ ...buyer, entity: "london_auction_xchange" }),
      ),
    ).toEqual({
      status: "rejected",
      reason: R.entityMismatch,
    });
    expect(h.books.requests.length).toBe(before);
  });
});

describe("write guard", () => {
  it("by default the adapter is dry-run: every write is refused and no request is sent", async () => {
    const h = await createAdapterHarness({ writes: { mode: "dry_run" } });
    const ports = createZohoBooksAdapter({ api: h.client, orgs: h.orgs });
    expect(await h.settle(ports.contacts.upsertContact(buyer))).toEqual({
      status: "rejected",
      reason: R.writesDisabled,
    });
    expect(await h.settle(ports.vendors.upsertVendor(buyer))).toEqual({
      status: "rejected",
      reason: R.writesDisabled,
    });
    expect((await h.settle(ports.invoices.issueInvoice(invoice))).status).toBe("rejected");
    expect(h.books.requests).toHaveLength(0);
  });

  it("writes only to the organisations on the allow-list", async () => {
    const h = await createAdapterHarness({
      writes: { mode: "test_org", organizationIds: [SHOP_ORG_ID] },
    });
    expect((await h.settle(h.ports.contacts.upsertContact(buyer))).status).toBe("issued");
    const before = h.books.requests.length;
    expect(await h.settle(h.ports.contacts.upsertContact(bidBuyer))).toEqual({
      status: "rejected",
      reason: R.writesDisabled,
    });
    expect(h.books.requests.length).toBe(before);
  });

  it("the API it hands out refuses a POST or PUT on its own, and lets reads through", async () => {
    let sent = 0;
    const api = {
      get: async () => {
        sent += 1;
        return zohoOk({ status: 200, body: {} });
      },
      post: async () => {
        sent += 1;
        return zohoOk({ status: 200, body: {} });
      },
      put: async () => {
        sent += 1;
        return zohoOk({ status: 200, body: {} });
      },
    } as unknown as ZohoApi;
    const gated = new WriteGate({ mode: "dry_run" }, testOrgConfigs()).guard(api);
    const post = await gated.post(SHOP_ORG_ID, "/invoices", {});
    const put = await gated.put(SHOP_ORG_ID, "/contacts/1", {});
    expect(post.ok || put.ok).toBe(false);
    if (!post.ok) expect(post.error.certainty).toBe("rejected");
    expect(sent).toBe(0);
    expect((await gated.get(SHOP_ORG_ID, "/invoices")).ok).toBe(true);
    expect(sent).toBe(1);
  });

  it("refuses an enabled mode with no organisations or one that is not configured", () => {
    const orgs = testOrgConfigs();
    const code = (f: () => unknown) => {
      try {
        f();
      } catch (error) {
        if (error instanceof ZohoBooksConfigError) return error.code;
        throw error;
      }
      return "accepted";
    };
    expect(code(() => new WriteGate({ mode: "live", organizationIds: [] }, orgs))).toBe(
      "write_allow_list_empty",
    );
    expect(
      code(() => new WriteGate({ mode: "live", organizationIds: ["9999999999999"] }, orgs)),
    ).toBe("write_allow_list_unknown_org");
    expect(code(() => new WriteGate({ mode: "yes" } as unknown as { mode: "dry_run" }, orgs))).toBe(
      "write_mode_invalid",
    );
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

/** The adapter over a scripted API, allowed to write to the Shop test organisation. */
const adapter = (api: ZohoApi) =>
  createZohoBooksAdapter({
    api,
    orgs: shopOnly(),
    writes: { mode: "test_org", organizationIds: [SHOP_ORG_ID] },
  });

describe("lookup guards", () => {
  const lookup = (api: ZohoApi) => adapter(api).lookup;

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
      contact_type: "customer",
      custom_field_hash: { cf_lax_reference: buyer.reference },
    },
  };

  it("an unreadable success reply is unknown, because Books may have made the document", async () => {
    const api = scripted({
      get: () => ({ code: 0, contacts: [] }),
      post: () => ({ code: 0, message: "ok" }),
    });
    const out = await adapter(api).contacts.upsertContact(buyer);
    expect(out).toEqual({ status: "unknown", detail: "zoho_books_unreadable_document" });
  });

  it("an amount that is not whole pence is unknown, never rounded", async () => {
    const api = scripted({
      get: () => ({ code: 0, contacts: [] }),
      post: () => ({ code: 0, contact: { contact_id: "9", contact_type: "customer" } }),
    });
    const ports = adapter(api);
    expect((await ports.contacts.upsertContact(buyer)).status).toBe("issued");
    const priced = scripted({
      get: (path) => (path === "/contacts" ? found : contactDetail),
      post: () => ({
        code: 0,
        invoice: {
          invoice_id: "5",
          invoice_number: "INV-5",
          sub_total: 100.005,
          tax_total: 0,
          total: 100.005,
        },
      }),
    });
    const out = await adapter(priced).invoices.issueInvoice(invoice);
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
    const out = await adapter(api).contacts.upsertContact(buyer);
    expect(out.status).toBe("rejected");
  });

  it("a document for an organisation that is not set up is rejected before anything is sent", async () => {
    const api = scripted({});
    const bidContact = unwrap(buildContact({ product: "bid", sourceId: "b1", name: "Bidder" }));
    const out = await adapter(api).contacts.upsertContact(bidContact);
    expect(out).toEqual({ status: "rejected", reason: "zoho_books_organisation_not_configured" });
  });

  it("an unconfirmed dependency lookup is unknown, a missing one is rejected", async () => {
    const down = scripted({ get: () => new ZohoValidationError({ code: "invalid_request" }) });
    const a = await adapter(down).invoices.issueInvoice(invoice);
    expect(a.status).toBe("unknown");
    const none = scripted({ get: () => ({ code: 0, contacts: [] }) });
    const b = await adapter(none).invoices.issueInvoice(invoice);
    expect(b).toEqual({ status: "rejected", reason: "zoho_books_contact_missing" });
  });
});

describe("read-back of what Books holds", () => {
  const contactRow = (type: string) => ({
    code: 0,
    contact: {
      contact_id: "1",
      contact_name: "x",
      contact_type: type,
      custom_field_hash: { cf_lax_reference: `${buyer.reference}:vendor` },
    },
  });

  it("refuses a bill when the contact found under the vendor reference is not a vendor", async () => {
    const seller = buyer;
    const bill = unwrap(
      buildBill({
        product: "shop",
        sourceId: "bill-x",
        contactReference: seller.reference,
        issuedOn: "2026-11-12",
        dueOn: "2026-11-19",
        lines: [
          {
            description: "Payout",
            quantity: 1,
            unitNetPence: 100,
            treatment: "outside_scope",
            role: "goods",
          },
        ],
      }),
    );
    const api = scripted({
      get: (path) =>
        path === "/contacts"
          ? { code: 0, contacts: [{ contact_id: "1" }] }
          : contactRow("customer"),
    });
    expect(await adapter(api).bills.issueBill(bill)).toEqual({
      status: "rejected",
      reason: R.contactNotVendor,
    });
  });

  const payment = unwrap(
    buildPayment({
      product: "shop",
      sourceId: "pay-rb",
      contactReference: buyer.reference,
      receivedOn: "2026-11-12",
      amountPence: 11_500,
      allocations: [{ invoiceReference: invoice.reference, amountPence: 11_500 }],
    }),
  );
  const held = (overrides: Json) => ({
    payment_id: "7",
    payment_number: "PMT-7",
    amount: 115,
    customer_id: "1",
    date: "2026-11-12",
    currency_code: "GBP",
    invoices: [{ invoice_id: "5", amount_applied: 115 }],
    custom_field_hash: { cf_lax_reference: payment.reference },
    ...overrides,
  });
  /** Contact 1 and invoice 5 exist; the payment create answers with `created`, or a duplicate. */
  function paymentApi(created: Json | "duplicate", adopted: Json = held({})): ZohoApi {
    return scripted({
      get: (path) => {
        if (path === "/contacts") return { code: 0, contacts: [{ contact_id: "1" }] };
        if (path === "/contacts/1")
          return {
            code: 0,
            contact: {
              contact_id: "1",
              contact_type: "customer",
              custom_field_hash: { cf_lax_reference: buyer.reference },
            },
          };
        if (path === "/invoices") return { code: 0, invoices: [{ invoice_id: "5" }] };
        if (path === "/invoices/5")
          return {
            code: 0,
            invoice: {
              invoice_id: "5",
              invoice_number: "INV-5",
              sub_total: 115,
              tax_total: 0,
              total: 115,
              custom_field_hash: { cf_lax_reference: invoice.reference },
            },
          };
        if (path === "/customerpayments")
          return { code: 0, customerpayments: [{ payment_id: "7" }] };
        return { code: 0, payment: adopted };
      },
      post: () =>
        created === "duplicate"
          ? new ZohoValidationError({
              code: "rejected_by_zoho",
              httpStatus: 400,
              zohoCode: DUPLICATE_ZOHO_CODE,
            })
          : { code: 0, payment: created },
    });
  }

  it("accepts a payment that reads back with the same invoice, amount, currency and date", async () => {
    expect((await adapter(paymentApi(held({}))).payments.recordPayment(payment)).status).toBe(
      "issued",
    );
    expect((await adapter(paymentApi("duplicate")).payments.recordPayment(payment)).status).toBe(
      "issued",
    );
  });

  it("refuses a payment that reads back different in invoice, amount, currency or date", async () => {
    const differences: Json[] = [
      { invoices: [{ invoice_id: "6", amount_applied: 115 }] },
      { invoices: [{ invoice_id: "5", amount_applied: 100 }] },
      { invoices: [] },
      { amount: 116 },
      { currency_code: "EUR" },
      { currency_code: undefined },
      { date: "2026-11-13" },
      { customer_id: "2" },
    ];
    for (const difference of differences) {
      for (const api of [paymentApi(held(difference)), paymentApi("duplicate", held(difference))]) {
        expect(await adapter(api).payments.recordPayment(payment)).toEqual({
          status: "rejected",
          reason: R.paymentMismatch,
        });
      }
    }
  });
});
