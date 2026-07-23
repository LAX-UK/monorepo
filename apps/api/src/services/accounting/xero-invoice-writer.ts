import type {
  IPaymentExternalRefRepository,
  IXeroConnectionRepository,
} from "@auction/persistence/interfaces";
import type { Lot } from "@auction/types";
import { Contact, Invoice, Invoices, LineAmountTypes, LineItem } from "xero-node";
import type { Env } from "../../env.js";
import { assertXeroApiWritesAllowed } from "../../lib/xero-api-writes-guard.js";
import { billToContextToXeroInvoiceToAddress } from "../bill-to-xero.js";
import type {
  IInvoiceAccountingProvider,
  InvoiceAccountingContext,
} from "../interfaces/invoice-accounting.js";
import type { InvoiceAddressingService } from "../invoice-addressing.js";
import type { XeroContactSync } from "./xero-contact-sync.js";
import type { XeroTokenService } from "./xero-token.service.js";

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function dueDate(from: Date, days: number): string {
  const t = new Date(from);
  t.setUTCDate(t.getUTCDate() + days);
  return isoDate(t);
}

export class XeroInvoiceWriter {
  constructor(
    private readonly env: Pick<
      Env,
      | "XERO_DEFAULT_REVENUE_ACCOUNT_CODE"
      | "XERO_DEFAULT_TAX_TYPE"
      | "XERO_INVOICE_DUE_DAYS"
      | "XERO_USE_LEGAL_ENTITY_CONTACT"
      | "XERO_API_WRITES_DISABLED"
    >,
    private readonly connections: IXeroConnectionRepository,
    private readonly externalRefs: IPaymentExternalRefRepository,
    private readonly tokens: XeroTokenService,
    private readonly contacts: XeroContactSync,
    private readonly invoiceAddressing: InvoiceAddressingService | null,
  ) {}

  async ensureInvoiceForPayment(
    ctx: InvoiceAccountingContext,
  ): Promise<{ ok: boolean; error?: string }> {
    try {
      assertXeroApiWritesAllowed(this.env);
    } catch {
      return { ok: false, error: "xero_api_writes_disabled" };
    }
    const conn = await this.connections.findLatest();
    if (!conn) {
      return { ok: false, error: "Xero is not connected" };
    }

    const existingRef = await this.externalRefs.findByPaymentId(ctx.paymentId);
    if (existingRef?.xeroInvoiceId) {
      return { ok: true };
    }

    const { xero, tenantId } = await this.tokens.initializeAuthenticatedClient(conn);
    const lot = ctx.lot as Lot;

    try {
      if (!existingRef) {
        await this.externalRefs.insertPending(ctx.paymentId);
      }
    } catch {
      // Row may already exist (retry).
    }

    let contactId: string;
    try {
      contactId = await this.contacts.resolveContactId(xero, tenantId, ctx);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await this.externalRefs.updateError(ctx.paymentId, msg);
      return { ok: false, error: msg };
    }

    try {
      const amountNum = Number.parseFloat(ctx.amount);
      if (!Number.isFinite(amountNum) || amountNum <= 0) {
        await this.externalRefs.updateError(
          ctx.paymentId,
          "Invalid payment amount for Xero invoice",
        );
        return { ok: false, error: "Invalid amount" };
      }

      const line = new LineItem();
      line.description = `Auction settlement — ${lot.title} (lot ${lot.lotNumber ?? lot.id})`;
      line.quantity = 1;
      line.unitAmount = amountNum;
      line.accountCode = this.env.XERO_DEFAULT_REVENUE_ACCOUNT_CODE;
      line.taxType = this.env.XERO_DEFAULT_TAX_TYPE;

      const inv = new Invoice();
      inv.type = Invoice.TypeEnum.ACCREC;
      const contactRef = new Contact();
      contactRef.contactID = contactId;
      inv.contact = contactRef;
      inv.lineItems = [line];
      inv.lineAmountTypes =
        this.env.XERO_DEFAULT_TAX_TYPE === "NONE"
          ? LineAmountTypes.NoTax
          : LineAmountTypes.Exclusive;
      const today = new Date();
      inv.date = isoDate(today);
      inv.dueDate = dueDate(today, this.env.XERO_INVOICE_DUE_DAYS);
      inv.reference = `payment:${ctx.paymentId}`;
      inv.status = Invoice.StatusEnum.AUTHORISED;

      if (this.env.XERO_USE_LEGAL_ENTITY_CONTACT && this.invoiceAddressing) {
        const { billTo } = await this.invoiceAddressing.resolveForPayment(ctx.paymentId);
        inv.invoiceAddresses = [billToContextToXeroInvoiceToAddress(billTo)];
      }

      const invoicesBody = new Invoices();
      invoicesBody.invoices = [inv];

      const created = await xero.accountingApi.createInvoices(
        tenantId,
        invoicesBody,
        false,
        undefined,
        `payment-${ctx.paymentId}`,
      );
      const createdInv = created.body.invoices?.[0];
      if (!createdInv?.invoiceID) {
        const msg =
          createdInv?.validationErrors?.map((v) => v.message).join("; ") ||
          "Xero did not return an invoice id";
        await this.externalRefs.updateError(ctx.paymentId, msg);
        return { ok: false, error: msg };
      }

      await this.externalRefs.updateInvoiceCreated(ctx.paymentId, {
        xeroInvoiceId: createdInv.invoiceID,
        xeroInvoiceNumber: createdInv.invoiceNumber ?? null,
        xeroContactId: contactId,
        onlineInvoiceUrl: null,
        syncStatus: "synced",
      });

      return { ok: true };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await this.externalRefs.updateError(ctx.paymentId, msg);
      return { ok: false, error: msg };
    }
  }

  async syncPaymentFromProvider(paymentId: string): Promise<{ ok: boolean; error?: string }> {
    const ref = await this.externalRefs.findByPaymentId(paymentId);
    if (!ref?.xeroInvoiceId) {
      return { ok: false, error: "No Xero invoice linked to this payment" };
    }
    const conn = await this.connections.findLatest();
    if (!conn) return { ok: false, error: "Xero not connected" };
    return this.syncInvoiceInternal(conn, ref.xeroInvoiceId, paymentId);
  }

  async syncInvoiceFromProvider(
    tenantId: string,
    invoiceId: string,
  ): Promise<{ ok: boolean; error?: string }> {
    const conn = await this.connections.findLatest();
    if (!conn || conn.tenantId !== tenantId) {
      return { ok: false, error: "Tenant mismatch or Xero not connected" };
    }
    const ref = await this.externalRefs.findByXeroInvoiceId(invoiceId);
    if (!ref) {
      return { ok: true };
    }
    return this.syncInvoiceInternal(conn, invoiceId, ref.paymentId);
  }

  private async syncInvoiceInternal(
    conn: Awaited<ReturnType<IXeroConnectionRepository["findLatest"]>> & object,
    invoiceId: string,
    paymentId: string,
  ): Promise<{ ok: boolean; error?: string }> {
    const { xero } = await this.tokens.initializeAuthenticatedClient(conn);
    try {
      const res = await xero.accountingApi.getInvoice(conn.tenantId, invoiceId);
      const inv = res.body.invoices?.[0];
      if (!inv) return { ok: false, error: "Invoice not found in Xero" };

      const firstPaymentId = inv.payments?.[0]?.paymentID ?? null;
      if (firstPaymentId) {
        await this.externalRefs.updateXeroPaymentId(paymentId, firstPaymentId);
      }

      return { ok: true };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  }
}

/** Compile-time contract: writer implements the accounting provider surface. */
export type XeroInvoiceWriterAccounting = Pick<
  IInvoiceAccountingProvider,
  "ensureInvoiceForPayment" | "syncPaymentFromProvider" | "syncInvoiceFromProvider"
>;
