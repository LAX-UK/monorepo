import {
  type DocumentPdfPort,
  type DocumentRecord,
  type Invoice,
  type TargetMode,
  ok,
  projectShopOrderPaid,
} from "@auction/accounting-domain";
import type {
  AccountingDocumentCopy,
  IAccountingDocumentCopies,
  InvoiceEmailDueList,
  InvoiceEmailSkipReason,
  ShopInvoiceEmailFacts,
  StoredAccountingDocument,
} from "@auction/persistence/interfaces";
import { describe, expect, it, vi } from "vitest";
import { AccountingInvoiceCopy } from "./accounting-invoice-copy.service.js";
import { composeShopInvoiceEmail, shopOrderUrl } from "./shop-invoice-email.js";

const ORDER_ID = "5b6a7c1e-1111-4a5b-8c9d-000000000001";
const NOW = new Date("2026-11-12T15:00:00Z");
const PDF = new TextEncoder().encode("%PDF-1.4\n%%EOF\n");

/** The order's invoice; abroad, its delivery (£40) is invoiced on its own and the order is £610. */
function shopInvoice(abroad = false, which: "order" | "delivery" = "order"): Invoice {
  const projected = projectShopOrderPaid({
    orderId: ORDER_ID,
    invoiceNumber: "LAX-INV-000124",
    buyer: { partyId: "5b6a7c1e-2222-4a5b-8c9d-000000000002", name: "Ada", email: null },
    paidOn: "2026-11-12",
    totalPence: abroad ? 61_000 : 59_500,
    lines: [
      {
        id: "a",
        kind: "goods",
        label: "Print",
        grossPence: 57_000,
        vatTreatment: null,
        vatPence: null,
      },
    ],
    delivery: abroad
      ? { scope: "outside_uk", label: "Delivery outside the UK", grossPence: 4_000, vatPence: null }
      : { scope: "uk", label: "UK insured delivery", grossPence: 2_500, vatPence: null },
  });
  if (!projected.ok) throw new Error(projected.refusal.code);
  const invoices = projected.value.documents.filter((d) => d.kind === "invoice") as Invoice[];
  return (which === "order" ? invoices[0] : invoices[1]) as Invoice;
}

function issued(
  mode: TargetMode,
  id: string,
  document: Invoice = shopInvoice(),
): StoredAccountingDocument {
  const record: DocumentRecord = {
    kind: "invoice",
    reference: document.reference,
    attempts: 1,
    status: "issued",
    issued: { number: "LAX-INV-000124", providerId: `p-${id}`, pdfRef: "/invoices/1" },
  };
  return {
    id,
    product: "shop",
    legalEntity: "london_art_exchange",
    kind: "invoice",
    reference: document.reference,
    sourceEventRef: "domain_event:1",
    document,
    totals: document.totals,
    provider: "books",
    target: { provider: "books", mode },
    record,
    lastErrorClass: null,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

/** The copies table in memory for Shop invoices (an order's id is its document's `order-<id>`). */
class Copies implements IAccountingDocumentCopies {
  readonly copies = new Map<
    string,
    AccountingDocumentCopy & { outbox?: string; skipped?: InvoiceEmailSkipReason }
  >();
  constructor(
    private readonly documents: StoredAccountingDocument[],
    /** A store that (wrongly) lists every mode as due, to test the service's own guard. */
    private readonly listsEveryMode = false,
  ) {}
  async listUncopied(modes: readonly TargetMode[]) {
    return {
      documents: this.documents.filter(
        (d) => d.target && modes.includes(d.target.mode) && !this.copies.has(d.id),
      ),
      unreadable: [],
    };
  }
  async record(copy: AccountingDocumentCopy) {
    if (this.copies.has(copy.documentId)) return false;
    this.copies.set(copy.documentId, copy);
    return true;
  }
  async listEmailDue(limit: number): Promise<InvoiceEmailDueList> {
    const due = this.documents
      .filter((d) => {
        const c = this.copies.get(d.id);
        return (
          c &&
          !c.rehearsal &&
          !c.outbox &&
          !c.skipped &&
          (this.listsEveryMode || d.target?.mode === "live")
        );
      })
      .slice(0, limit)
      .map((d) => ({
        documentId: d.id,
        product: "shop" as const,
        invoiceId: d.reference.endsWith("-delivery") ? `order-${d.id}-delivery` : `order-${d.id}`,
        number: "LAX-INV-000124",
        grossPence: d.totals.grossPence,
        storageKey: this.copies.get(d.id)?.storageKey ?? "",
      }));
    return { due, unreadable: [] };
  }
  async markEmailQueued(documentId: string, outboxId: string) {
    const c = this.copies.get(documentId);
    if (!c || c.outbox || c.skipped) return false;
    this.copies.set(documentId, { ...c, outbox: outboxId });
    return true;
  }
  async markEmailSkipped(documentId: string, reason: InvoiceEmailSkipReason) {
    const c = this.copies.get(documentId);
    if (!c || c.outbox || c.skipped) return false;
    this.copies.set(documentId, { ...c, skipped: reason });
    return true;
  }
}

const facts = (over: Partial<ShopInvoiceEmailFacts> = {}): ShopInvoiceEmailFacts => ({
  orderId: ORDER_ID,
  orderReference: "LAX-S-10482",
  totalPence: 59_500,
  paidAt: new Date("2026-11-12T14:05:00Z"),
  cancelled: false,
  guest: false,
  recipient: { email: "ada@example.test", name: "Ada" },
  ...over,
});

function setUp(
  mode: TargetMode,
  documents: StoredAccountingDocument[],
  factsFor: (orderId: string) => ShopInvoiceEmailFacts | null = () => facts(),
  batch?: number,
  listsEveryMode = false,
  storefront: { readonly url: string | undefined } = { url: "https://shop.example.test/" },
) {
  const copies = new Copies(documents, listsEveryMode);
  let n = 0;
  const enqueue = vi.fn(async () => ({ outboxId: `outbox-${++n}` }));
  const pdf: DocumentPdfPort = {
    fetchPdf: vi.fn(async () => ({
      status: "fetched" as const,
      bytes: PDF,
      contentType: "application/pdf" as const,
      rehearsal: mode === "dry_run",
    })),
  };
  const bidFacts = vi.fn(async () => null);
  const log = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
  const service = new AccountingInvoiceCopy({
    copies,
    settings: {
      read: async () =>
        ok({
          bid: { xero: "live", books: "off" },
          shop: { xero: "off", books: mode },
          lax_art: { xero: "off", books: "off" },
        }),
    },
    pdfsByMode: { [mode]: pdf },
    storage: { putObject: vi.fn(async () => ({})) },
    emailFacts: { forInvoice: bidFacts },
    shopEmailFacts: { forOrder: async (orderId) => factsFor(orderId) },
    email: { enqueue },
    webBaseUrl: "https://lax.bid",
    shopStorefrontUrl: storefront.url,
    now: () => NOW,
    log,
    ...(batch ? { batch } : {}),
  });
  return { service, copies, enqueue, bidFacts, log };
}

describe("Shop invoice copies and email", () => {
  it("keeps the copy under London Art Exchange and emails the order's owner once (live)", async () => {
    const { service, copies, enqueue, bidFacts } = setUp("live", [issued("live", "doc-1")]);
    expect(await service.tick()).toEqual({ stored: 1, emailed: 1 });
    expect(copies.copies.get("doc-1")?.storageKey).toBe("accounting/london_art_exchange/doc-1.pdf");
    expect(enqueue).toHaveBeenCalledTimes(1);
    expect(enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        template: "shop-invoice-issued",
        to: "ada@example.test",
        recipientResolution: "snapshot",
        category: "transactional",
        idempotencyKey: "shop-invoice-issued:doc-1",
        vars: expect.objectContaining({
          invoiceNumber: "LAX-INV-000124",
          orderReference: "LAX-S-10482",
          total: "£595.00",
          paidOn: "Thu 12 Nov, 14:05 GMT",
          orderUrl: `https://shop.example.test/account/orders/${ORDER_ID}`,
        }),
      }),
    );
    // A Shop invoice never reads Bid's facts or reaches a Bid payer or billing inbox.
    expect(bidFacts).not.toHaveBeenCalled();
    expect(await service.tick()).toEqual({ stored: 0, emailed: 0 });
    expect(enqueue).toHaveBeenCalledTimes(1);
  });

  it("emails no one in a rehearsal or at the test organisation", async () => {
    for (const mode of ["dry_run", "test_org"] as const) {
      const { service, enqueue } = setUp(mode, [issued(mode, `doc-${mode}`)]);
      expect(await service.tick()).toEqual({ stored: 1, emailed: 0 });
      expect(enqueue).not.toHaveBeenCalled();
    }
  });

  it("emails no one at the test organisation even when the store wrongly lists it as due", async () => {
    const { service, enqueue } = setUp(
      "test_org",
      [issued("test_org", "doc-t")],
      () => facts(),
      undefined,
      true,
    );
    await service.tick();
    await service.tick();
    expect(enqueue).not.toHaveBeenCalled();
  });

  it("settles an order it will never email, so the one behind it is emailed (batch of 1)", async () => {
    const { service, copies, enqueue } = setUp(
      "live",
      [
        issued("live", "doc-a"),
        issued("live", "doc-b"),
        issued("live", "doc-c"),
        issued("live", "doc-d"),
      ],
      (orderId) =>
        orderId === "order-doc-a"
          ? facts({ cancelled: true })
          : orderId === "order-doc-b"
            ? facts({ recipient: null })
            : orderId === "order-doc-c"
              ? null
              : facts(),
      1,
    );
    for (let i = 0; i < 8; i += 1) await service.tick();
    expect(copies.copies.get("doc-a")?.skipped).toBe("invoice_cancelled");
    expect(copies.copies.get("doc-b")?.skipped).toBe("no_recipient");
    expect(copies.copies.get("doc-c")?.skipped).toBe("invoice_missing");
    expect(copies.copies.get("doc-d")?.outbox).toBe("outbox-1");
    expect(enqueue).toHaveBeenCalledTimes(1);
  });
});

describe("Shop invoice email: what it says, and when it is refused", () => {
  it("states the attached invoice's own total, not the order's, when delivery is outside the UK", async () => {
    const { service, enqueue } = setUp("live", [issued("live", "doc-1", shopInvoice(true))], () =>
      facts({ totalPence: 61_000 }),
    );
    expect(await service.tick()).toEqual({ stored: 1, emailed: 1 });
    expect(enqueue).toHaveBeenCalledWith(
      expect.objectContaining({ vars: expect.objectContaining({ total: "£570.00" }) }),
    );
  });

  it("does not email a released outside-UK delivery invoice as if it were the order's", async () => {
    const delivery = issued("live", "doc-d", shopInvoice(true, "delivery"));
    const { service, copies, enqueue } = setUp("live", [delivery]);
    await service.tick();
    expect(copies.copies.get("doc-d")?.skipped).toBe("not_order_invoice");
    expect(enqueue).not.toHaveBeenCalled();
  });

  it("sends no Shop email while SHOP_STOREFRONT_URL is unset or local; each stays due", async () => {
    for (const url of [
      undefined,
      "",
      "http://localhost:3020",
      "https://localhost",
      "https://127.0.0.1:3020",
      "https://shop.local",
      "http://shop.example.test",
    ]) {
      const { service, copies, enqueue, log } = setUp(
        "live",
        [issued("live", "doc-1")],
        () => facts(),
        undefined,
        false,
        { url },
      );
      expect(await service.tick()).toEqual({ stored: 1, emailed: 0 });
      expect(enqueue).not.toHaveBeenCalled();
      // Not settled: it goes once the address is set.
      expect(copies.copies.get("doc-1")?.skipped).toBeUndefined();
      expect(log.error).toHaveBeenCalledWith(
        { reason: expect.stringMatching(/^SHOP_STOREFRONT_URL /) },
        "accounting_shop_invoice_email_refused",
      );
    }
  });
});

describe("composeShopInvoiceEmail", () => {
  it("formats the invoice's stored total and the paid moment, and attaches LAX's stored copy", () => {
    const vars = composeShopInvoiceEmail({
      number: "LAX-INV-000124",
      facts: facts(),
      invoiceGrossPence: 59_500,
      storageKey: "accounting/london_art_exchange/doc-1.pdf",
      storefrontUrl: "https://shop.example.test",
      now: NOW,
    });
    expect(vars).toEqual({
      userName: "Ada",
      invoiceNumber: "LAX-INV-000124",
      orderReference: "LAX-S-10482",
      total: "£595.00",
      paidOn: "Thu 12 Nov, 14:05 GMT",
      storedAttachment: {
        storageKey: "accounting/london_art_exchange/doc-1.pdf",
        filename: "invoice-LAX-INV-000124.pdf",
        contentType: "application/pdf",
      },
      orderUrl: `https://shop.example.test/account/orders/${ORDER_ID}`,
    });
  });

  it("sends a guest to the page that mails them a fresh link to the order", () => {
    expect(shopOrderUrl("https://shop.example.test/", facts({ guest: true }))).toBe(
      "https://shop.example.test/orders/guest",
    );
  });
});
