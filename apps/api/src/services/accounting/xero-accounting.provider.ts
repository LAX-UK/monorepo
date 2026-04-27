import type { Lot } from "@auction/types";
import {
  Contact,
  Contacts,
  Invoice,
  Invoices,
  LineAmountTypes,
  LineItem,
  XeroClient,
} from "xero-node";
import type { TokenSet } from "xero-node";
import type { Env } from "../../env.js";
import type {
  AccountingCheckoutContext,
  AccountingCheckoutResult,
  IPaymentAccountingProvider,
} from "../interfaces/payment-accounting-provider.js";
import type {
  IPaymentExternalRefRepository,
  IXeroConnectionRepository,
  XeroConnectionRow,
} from "../interfaces/xero-repositories.js";

const XERO_SCOPES = [
  "openid",
  "profile",
  "email",
  "offline_access",
  "accounting.settings",
  "accounting.contacts",
  "accounting.transactions",
];

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function dueDate(from: Date, days: number): string {
  const t = new Date(from);
  t.setUTCDate(t.getUTCDate() + days);
  return isoDate(t);
}

function tokenExpiryDate(tokenSet: TokenSet): Date {
  const raw = tokenSet.expires_at;
  if (raw == null) return new Date(Date.now() + 25 * 60_000);
  const sec = typeof raw === "number" ? raw : Number.parseInt(String(raw), 10);
  if (!Number.isFinite(sec)) return new Date(Date.now() + 25 * 60_000);
  return new Date(sec * 1000);
}

export class XeroAccountingProvider implements IPaymentAccountingProvider {
  constructor(
    private readonly env: Pick<
      Env,
      | "XERO_CLIENT_ID"
      | "XERO_CLIENT_SECRET"
      | "XERO_REDIRECT_URI"
      | "XERO_DEFAULT_REVENUE_ACCOUNT_CODE"
      | "XERO_DEFAULT_TAX_TYPE"
      | "XERO_INVOICE_DUE_DAYS"
    >,
    private readonly connections: IXeroConnectionRepository,
    private readonly externalRefs: IPaymentExternalRefRepository,
    private readonly onInvoicePaid: (paymentId: string) => Promise<void>,
  ) {}

  isConfigured(): boolean {
    return Boolean(
      this.env.XERO_CLIENT_ID && this.env.XERO_CLIENT_SECRET && this.env.XERO_REDIRECT_URI,
    );
  }

  private baseClient(state?: string): XeroClient {
    const cfg: ConstructorParameters<typeof XeroClient>[0] = {
      clientId: this.env.XERO_CLIENT_ID as string,
      clientSecret: this.env.XERO_CLIENT_SECRET as string,
      redirectUris: [this.env.XERO_REDIRECT_URI as string],
      scopes: XERO_SCOPES,
    };
    if (state !== undefined) {
      cfg.state = state;
    }
    return new XeroClient(cfg);
  }

  async getCheckoutUrlIfAny(paymentId: string): Promise<string | null> {
    const row = await this.externalRefs.findByPaymentId(paymentId);
    return row?.onlineInvoiceUrl ?? null;
  }

  async createCheckoutForWinner(ctx: AccountingCheckoutContext): Promise<AccountingCheckoutResult> {
    const conn = await this.connections.findLatest();
    if (!conn) {
      return { checkoutUrl: null, error: "Xero is not connected" };
    }

    const existingRef = await this.externalRefs.findByPaymentId(ctx.paymentId);
    if (existingRef?.onlineInvoiceUrl) {
      return { checkoutUrl: existingRef.onlineInvoiceUrl };
    }

    const xero = this.baseClient();
    await xero.initialize();
    await this.applyStoredTokens(xero, conn);
    const liveConn = await this.refreshIfNeeded(xero, conn);

    const tenantId = liveConn.tenantId;
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
      contactId = await this.ensureContact(xero, tenantId, ctx.buyerName, ctx.buyerEmail);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await this.externalRefs.updateError(ctx.paymentId, msg);
      return { checkoutUrl: null, error: msg };
    }

    if (existingRef?.xeroInvoiceId && !existingRef.onlineInvoiceUrl) {
      try {
        const online = await xero.accountingApi.getOnlineInvoice(
          tenantId,
          existingRef.xeroInvoiceId,
        );
        const url = online.body.onlineInvoices?.[0]?.onlineInvoiceUrl ?? null;
        if (url) {
          await this.externalRefs.patchOnlineInvoiceUrl(ctx.paymentId, url);
          return { checkoutUrl: url };
        }
      } catch {
        // fall through to create a new invoice path if URL recovery fails
      }
    }

    try {
      const amountNum = Number.parseFloat(ctx.amount);
      if (!Number.isFinite(amountNum) || amountNum <= 0) {
        await this.externalRefs.updateError(
          ctx.paymentId,
          "Invalid payment amount for Xero invoice",
        );
        return { checkoutUrl: null, error: "Invalid amount" };
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
        return { checkoutUrl: null, error: msg };
      }

      const online = await xero.accountingApi.getOnlineInvoice(tenantId, createdInv.invoiceID);
      const url = online.body.onlineInvoices?.[0]?.onlineInvoiceUrl ?? null;
      if (!url) {
        await this.externalRefs.updateError(
          ctx.paymentId,
          "Xero did not return an online invoice URL",
        );
        return { checkoutUrl: null, error: "Missing online invoice URL" };
      }

      await this.externalRefs.updateSuccess(ctx.paymentId, {
        xeroInvoiceId: createdInv.invoiceID,
        xeroInvoiceNumber: createdInv.invoiceNumber ?? null,
        xeroContactId: contactId,
        onlineInvoiceUrl: url,
        syncStatus: "synced",
      });

      return { checkoutUrl: url };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await this.externalRefs.updateError(ctx.paymentId, msg);
      return { checkoutUrl: null, error: msg };
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
    conn: XeroConnectionRow,
    invoiceId: string,
    paymentId: string,
  ): Promise<{ ok: boolean; error?: string }> {
    const xero = this.baseClient();
    await xero.initialize();
    await this.applyStoredTokens(xero, conn);
    await this.refreshIfNeeded(xero, conn);
    try {
      const res = await xero.accountingApi.getInvoice(conn.tenantId, invoiceId);
      const inv = res.body.invoices?.[0];
      if (!inv) return { ok: false, error: "Invoice not found in Xero" };

      const amountDue = inv.amountDue ?? 0;
      const status = inv.status;
      const paid =
        status === Invoice.StatusEnum.PAID ||
        amountDue <= 0.000_001 ||
        Boolean(inv.fullyPaidOnDate);

      if (paid) {
        await this.onInvoicePaid(paymentId);
      }

      const firstPaymentId = inv.payments?.[0]?.paymentID ?? null;
      if (firstPaymentId) {
        await this.externalRefs.updateXeroPaymentId(paymentId, firstPaymentId);
      }

      return { ok: true };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  }

  private async ensureContact(
    xero: XeroClient,
    tenantId: string,
    name: string,
    email: string,
  ): Promise<string> {
    const existing = await xero.accountingApi.getContacts(
      tenantId,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      email,
      undefined,
    );
    const hit = existing.body.contacts?.find(
      (c) => c.emailAddress?.toLowerCase() === email.toLowerCase(),
    );
    if (hit?.contactID) return hit.contactID;

    const c = new Contact();
    c.name = name || email;
    c.emailAddress = email;
    const body = new Contacts();
    body.contacts = [c];
    const created = await xero.accountingApi.createContacts(tenantId, body, false);
    const out = created.body.contacts?.[0];
    if (!out?.contactID) {
      throw new Error(
        out?.validationErrors?.map((v) => v.message).join("; ") || "Failed to create Xero contact",
      );
    }
    return out.contactID;
  }

  private async applyStoredTokens(xero: XeroClient, conn: XeroConnectionRow): Promise<void> {
    xero.setTokenSet({
      access_token: conn.accessToken,
      refresh_token: conn.refreshToken,
      expires_at: Math.floor(conn.expiresAt.getTime() / 1000),
    } as TokenSet);
  }

  private async refreshIfNeeded(
    xero: XeroClient,
    conn: XeroConnectionRow,
  ): Promise<XeroConnectionRow> {
    const skewMs = 120_000;
    if (conn.expiresAt.getTime() > Date.now() + skewMs) {
      return conn;
    }
    const refreshed = await xero.refreshToken();
    const exp = tokenExpiryDate(refreshed);
    await this.connections.updateTokens(conn.tenantId, {
      accessToken: refreshed.access_token ?? conn.accessToken,
      refreshToken: refreshed.refresh_token ?? conn.refreshToken,
      expiresAt: exp,
    });
    const next = await this.connections.findLatest();
    if (!next) throw new Error("Xero connection missing after refresh");
    xero.setTokenSet({
      access_token: next.accessToken,
      refresh_token: next.refreshToken,
      expires_at: Math.floor(next.expiresAt.getTime() / 1000),
    } as TokenSet);
    return next;
  }
}

/** Scopes used for Xero OAuth (exported for OAuth service). */
export function getXeroScopes(): string[] {
  return [...XERO_SCOPES];
}

export function createXeroClientForOAuth(
  env: Pick<Env, "XERO_CLIENT_ID" | "XERO_CLIENT_SECRET" | "XERO_REDIRECT_URI">,
  state?: string,
): XeroClient {
  const cfg: ConstructorParameters<typeof XeroClient>[0] = {
    clientId: env.XERO_CLIENT_ID as string,
    clientSecret: env.XERO_CLIENT_SECRET as string,
    redirectUris: [env.XERO_REDIRECT_URI as string],
    scopes: XERO_SCOPES,
  };
  if (state !== undefined) {
    cfg.state = state;
  }
  return new XeroClient(cfg);
}
