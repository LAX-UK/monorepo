import type {
  IPaymentExternalRefRepository,
  IXeroConnectionRepository,
  XeroConnectionRow,
} from "@auction/persistence/interfaces";
import type { Redis } from "ioredis";
import {
  type Account,
  CreditNote,
  CreditNotes,
  type Invoice,
  LineAmountTypes,
  LineItem,
  Payment,
  Payments,
  XeroClient,
} from "xero-node";
import type { Env } from "../../env.js";
import type { IErrorReporter } from "../interfaces/error-handling.js";
import { applyStoredTokens, refreshXeroTokensIfNeeded } from "./xero-auth-runtime.js";
import { getXeroScopes } from "./xero-token.service.js";

export interface IXeroPaymentRecorder {
  recordStripeCapture(
    paymentId: string,
    amountMajor: string,
  ): Promise<{ ok: boolean; error?: string }>;

  recordRefundCreditNote(
    paymentId: string,
    amountMajor: string,
    reference: string,
  ): Promise<{ ok: boolean; error?: string }>;
}

/** Records a bank payment against an existing Xero ACCREC invoice after Stripe capture. */
export class XeroPaymentRecorder implements IXeroPaymentRecorder {
  constructor(
    private readonly env: Pick<
      Env,
      | "XERO_CLIENT_ID"
      | "XERO_CLIENT_SECRET"
      | "XERO_REDIRECT_URI"
      | "XERO_PAYMENT_BANK_ACCOUNT_CODE"
    >,
    private readonly connections: IXeroConnectionRepository,
    private readonly externalRefs: IPaymentExternalRefRepository,
    private readonly errorReporter: IErrorReporter,
    private readonly redis: Redis,
  ) {}

  isConfigured(): boolean {
    return Boolean(
      this.env.XERO_CLIENT_ID &&
        this.env.XERO_CLIENT_SECRET &&
        this.env.XERO_REDIRECT_URI &&
        this.env.XERO_PAYMENT_BANK_ACCOUNT_CODE,
    );
  }

  async recordStripeCapture(
    paymentId: string,
    amountMajor: string,
  ): Promise<{ ok: boolean; error?: string }> {
    if (!this.isConfigured()) {
      return { ok: false, error: "Xero payment recording not configured" };
    }

    const ref = await this.externalRefs.findByPaymentId(paymentId);
    if (!ref?.xeroInvoiceId) {
      return { ok: false, error: "No Xero invoice linked" };
    }
    if (ref.xeroPaymentId) {
      return { ok: true };
    }

    const conn = await this.connections.findLatest();
    if (!conn) return { ok: false, error: "Xero not connected" };

    const xero = this.baseClient();
    await xero.initialize();
    await applyStoredTokens(xero, conn);
    const liveConn = await this.refreshXeroTokensReporting(xero, conn);

    try {
      const pay = new Payment();
      pay.invoice = { invoiceID: ref.xeroInvoiceId } as Invoice;
      pay.account = { code: this.env.XERO_PAYMENT_BANK_ACCOUNT_CODE } as Account;
      pay.amount = Number.parseFloat(amountMajor);
      pay.reference = `stripe:payment:${paymentId}`;

      const body = new Payments();
      body.payments = [pay];

      const created = await xero.accountingApi.createPayments(
        liveConn.tenantId,
        body,
        false,
        `xero-pay:${paymentId}`,
      );
      const xeroPaymentId = created.body.payments?.[0]?.paymentID ?? null;
      if (!xeroPaymentId) {
        const msg = "Xero createPayments succeeded but returned no paymentID";
        await this.externalRefs.updateError(paymentId, msg);
        return { ok: false, error: msg };
      }
      await this.externalRefs.updateXeroPaymentId(paymentId, xeroPaymentId);
      return { ok: true };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await this.externalRefs.updateError(paymentId, msg);
      this.errorReporter.report({
        severity: "warn",
        code: "xero_payment_record_failed",
        message: msg,
        status: 502,
        cause: e,
      });
      return { ok: false, error: msg };
    }
  }

  async recordRefundCreditNote(
    paymentId: string,
    amountMajor: string,
    reference: string,
  ): Promise<{ ok: boolean; error?: string }> {
    if (!this.isConfigured()) {
      return { ok: false, error: "Xero payment recording not configured" };
    }

    const ref = await this.externalRefs.findByPaymentId(paymentId);
    if (!ref?.xeroInvoiceId) {
      return { ok: false, error: "No Xero invoice linked" };
    }

    const conn = await this.connections.findLatest();
    if (!conn) return { ok: false, error: "Xero not connected" };

    const xero = this.baseClient();
    await xero.initialize();
    await applyStoredTokens(xero, conn);
    const liveConn = await this.refreshXeroTokensReporting(xero, conn);

    try {
      const amountNum = Number.parseFloat(amountMajor);
      if (!Number.isFinite(amountNum) || amountNum <= 0) {
        return { ok: false, error: "Invalid refund amount" };
      }

      const line = new LineItem();
      line.description = `Refund — ${reference}`;
      line.quantity = 1;
      line.unitAmount = amountNum;
      line.accountCode = this.env.XERO_PAYMENT_BANK_ACCOUNT_CODE;

      const credit = new CreditNote();
      credit.type = CreditNote.TypeEnum.ACCRECCREDIT;
      if (ref.xeroContactId) {
        credit.contact = { contactID: ref.xeroContactId };
      }
      credit.lineItems = [line];
      credit.lineAmountTypes = LineAmountTypes.NoTax;
      credit.reference = reference;

      const body = new CreditNotes();
      body.creditNotes = [credit];

      await xero.accountingApi.createCreditNotes(
        liveConn.tenantId,
        body,
        false,
        undefined,
        `xero-refund-cn:${paymentId}:${reference}`,
      );
      return { ok: true };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.errorReporter.report({
        severity: "warn",
        code: "xero_refund_credit_note_failed",
        message: msg,
        status: 502,
        cause: e,
      });
      return { ok: false, error: msg };
    }
  }

  private baseClient(): XeroClient {
    return new XeroClient({
      clientId: this.env.XERO_CLIENT_ID as string,
      clientSecret: this.env.XERO_CLIENT_SECRET as string,
      redirectUris: [this.env.XERO_REDIRECT_URI as string],
      scopes: getXeroScopes(),
    });
  }

  private async refreshXeroTokensReporting(
    xero: XeroClient,
    conn: XeroConnectionRow,
  ): Promise<XeroConnectionRow> {
    try {
      return await refreshXeroTokensIfNeeded(xero, this.connections, conn, {
        redis: this.redis,
      });
    } catch (cause) {
      this.errorReporter.report({
        severity: "error",
        code: "xero_refresh_failed",
        message: "Xero OAuth token refresh failed",
        status: 502,
        cause,
      });
      throw cause;
    }
  }
}
