import type {
  IPaymentExternalRefRepository,
  IXeroConnectionRepository,
} from "@auction/persistence/interfaces";
import type { Lot } from "@auction/types";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { InvoiceAccountingContext } from "../interfaces/invoice-accounting.js";
import type { XeroContactSync } from "./xero-contact-sync.js";
import { XeroInvoiceWriter } from "./xero-invoice-writer.js";
import type { XeroTokenService } from "./xero-token.service.js";

const env = {
  XERO_DEFAULT_REVENUE_ACCOUNT_CODE: "200",
  XERO_DEFAULT_TAX_TYPE: "NONE",
  XERO_USE_LEGAL_ENTITY_CONTACT: false,
  XERO_API_WRITES_DISABLED: false,
};

const ctx: InvoiceAccountingContext = {
  paymentId: "pay-1",
  lot: { id: "lot-1", title: "Blue Vase", lotNumber: 12 } as Lot,
  buyerEmail: "buyer@example.com",
  buyerName: "Buyer",
  amount: "1250.00",
  raisedAt: new Date("2026-11-02T23:30:00.000Z"),
};

function build(overrides: { env?: Partial<typeof env> } = {}) {
  const createInvoices = vi.fn().mockResolvedValue({
    body: { invoices: [{ invoiceID: "xero-inv-1", invoiceNumber: "INV-0001" }] },
  });
  const externalRefs = {
    findByPaymentId: vi.fn().mockResolvedValue(null),
    insertPending: vi.fn().mockResolvedValue(undefined),
    updateError: vi.fn().mockResolvedValue(undefined),
    updateInvoiceCreated: vi.fn().mockResolvedValue(undefined),
  };
  const writer = new XeroInvoiceWriter(
    { ...env, ...overrides.env },
    {
      findLatest: vi.fn().mockResolvedValue({ tenantId: "t-1" }),
    } as unknown as IXeroConnectionRepository,
    externalRefs as unknown as IPaymentExternalRefRepository,
    {
      initializeAuthenticatedClient: vi.fn().mockResolvedValue({
        xero: { accountingApi: { createInvoices } },
        tenantId: "t-1",
      }),
    } as unknown as XeroTokenService,
    { resolveContactId: vi.fn().mockResolvedValue("contact-1") } as unknown as XeroContactSync,
    null,
  );
  return { writer, createInvoices, externalRefs };
}

describe("XeroInvoiceWriter.ensureInvoiceForPayment", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-05T10:00:00.000Z"));
  });
  afterEach(() => vi.useRealTimers());

  it("writes one authorised line at the invoice total, idempotent on the payment", async () => {
    const { writer, createInvoices, externalRefs } = build();
    await expect(writer.ensureInvoiceForPayment(ctx)).resolves.toEqual({ ok: true });

    const [tenantId, body, , , idempotencyKey] = createInvoices.mock.calls[0] ?? [];
    expect(tenantId).toBe("t-1");
    expect(idempotencyKey).toBe("payment-pay-1");
    const invoice = body.invoices[0];
    expect(invoice.reference).toBe("payment:pay-1");
    expect(invoice.status).toBe("AUTHORISED");
    expect(invoice.lineItems).toHaveLength(1);
    expect(invoice.lineItems[0]).toMatchObject({
      description: "Auction settlement — Blue Vase (lot 12)",
      quantity: 1,
      unitAmount: 1250,
      accountCode: "200",
      taxType: "NONE",
    });
    expect(externalRefs.updateInvoiceCreated).toHaveBeenCalledWith(
      "pay-1",
      expect.objectContaining({ xeroInvoiceId: "xero-inv-1", xeroInvoiceNumber: "INV-0001" }),
    );
  });

  it("dates the invoice when it was raised and makes it due on the buyer's 7-day term", async () => {
    const { writer, createInvoices } = build();
    // Written to Xero three days late; still dated and due as the buyer's invoice is.
    await writer.ensureInvoiceForPayment(ctx);
    const invoice = createInvoices.mock.calls[0]?.[1].invoices[0];
    expect(invoice.date).toBe("2026-11-02");
    expect(invoice.dueDate).toBe("2026-11-09");
  });

  it("uses the London calendar day, so a late-evening invoice in summer is not a day early", async () => {
    const { writer, createInvoices } = build();
    await writer.ensureInvoiceForPayment({
      ...ctx,
      raisedAt: new Date("2026-07-01T23:30:00.000Z"),
    });
    const invoice = createInvoices.mock.calls[0]?.[1].invoices[0];
    expect(invoice.date).toBe("2026-07-02");
    expect(invoice.dueDate).toBe("2026-07-09");
  });

  it("writes nothing while Xero writes are switched off in this process", async () => {
    const { writer, createInvoices, externalRefs } = build({
      env: { XERO_API_WRITES_DISABLED: true },
    });
    await expect(writer.ensureInvoiceForPayment(ctx)).resolves.toEqual({
      ok: false,
      error: "xero_api_writes_disabled",
    });
    expect(createInvoices).not.toHaveBeenCalled();
    expect(externalRefs.insertPending).not.toHaveBeenCalled();
  });

  it("does nothing when the invoice was already written", async () => {
    const { writer, createInvoices, externalRefs } = build();
    externalRefs.findByPaymentId.mockResolvedValue({ xeroInvoiceId: "xero-inv-1" });
    await expect(writer.ensureInvoiceForPayment(ctx)).resolves.toEqual({ ok: true });
    expect(createInvoices).not.toHaveBeenCalled();
  });
});
