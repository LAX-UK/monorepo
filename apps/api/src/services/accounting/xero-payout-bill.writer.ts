import {
  Contact,
  CurrencyCode,
  Invoice,
  Invoices,
  LineAmountTypes,
  LineItem,
  XeroClient,
} from "xero-node";
import type { Env } from "../../env.js";
import type { IErrorReporter } from "../interfaces/error-handling.js";
import type { ILegalEntityRepository } from "../interfaces/legal-entity-repository.js";
import type { IPayoutRepository } from "../interfaces/payout-repository.js";
import type {
  IXeroConnectionRepository,
  XeroConnectionRow,
} from "../interfaces/xero-repositories.js";
import { applyStoredTokens, refreshXeroTokensIfNeeded } from "./xero-auth-runtime.js";
import { getXeroScopes } from "./xero-accounting.provider.js";
import { ensureXeroContactForLegalEntity } from "./xero-legal-entity-contact.js";

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** after a payout is paid, create a Xero supplier bill (ACCPAY) against the
 * seller legal entity contact and persist `payout.xero_bill_id`. Idempotent.
 */
export class XeroPayoutBillWriter {
  constructor(
    private readonly env: Pick<
      Env,
      | "XERO_CLIENT_ID"
      | "XERO_CLIENT_SECRET"
      | "XERO_REDIRECT_URI"
      | "XERO_DEFAULT_TAX_TYPE"
      | "XERO_PAYOUT_BILL_ACCOUNT_CODE"
    >,
    private readonly connections: IXeroConnectionRepository,
    private readonly payouts: IPayoutRepository,
    private readonly legalEntities: ILegalEntityRepository,
    private readonly errorReporter: IErrorReporter,
  ) {}

  private async refreshXeroTokensReporting(
    xero: XeroClient,
    conn: XeroConnectionRow,
  ): Promise<XeroConnectionRow> {
    try {
      return await refreshXeroTokensIfNeeded(xero, this.connections, conn);
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

  private baseClient(): XeroClient {
    return new XeroClient({
      clientId: this.env.XERO_CLIENT_ID as string,
      clientSecret: this.env.XERO_CLIENT_SECRET as string,
      redirectUris: [this.env.XERO_REDIRECT_URI as string],
      scopes: getXeroScopes(),
    });
  }

  async syncPaidPayout(payoutId: string): Promise<{
    ok: boolean;
    skipped?: boolean;
    xeroBillId?: string;
    error?: string;
  }> {
    const payout = await this.payouts.findById(payoutId);
    if (!payout) {
      return { ok: false, error: "payout_not_found" };
    }
    if (payout.status !== "paid") {
      return { ok: true, skipped: true };
    }
    if (payout.xeroBillId) {
      return { ok: true, skipped: true, xeroBillId: payout.xeroBillId };
    }

    const entity = await this.legalEntities.findById(payout.legalEntityId);
    if (!entity) {
      return { ok: false, error: "legal_entity_not_found" };
    }

    const conn = await this.connections.findLatest();
    if (!conn) {
      return { ok: false, error: "Xero is not connected" };
    }

    const net = Number.parseFloat(payout.netAmount);
    if (!Number.isFinite(net) || net <= 0) {
      return { ok: false, error: "invalid_net_amount" };
    }

    const xero = this.baseClient();
    await xero.initialize();
    await applyStoredTokens(xero, conn);
    const liveConn = await this.refreshXeroTokensReporting(xero, conn);
    const tenantId = liveConn.tenantId;

    try {
      const billingAddress = await this.legalEntities.findPrimaryAddressForXero(entity.id);
      const contactId = await ensureXeroContactForLegalEntity({
        xero,
        tenantId,
        entity,
        billingAddress,
        persistContactId: (id, cid) => this.legalEntities.setXeroContactId(id, cid),
      });

      const line = new LineItem();
      line.description = `Seller payout ${payout.id} (${isoDate(payout.periodStart)}–${isoDate(payout.periodEnd)})`;
      line.quantity = 1;
      line.unitAmount = net;
      line.accountCode = this.env.XERO_PAYOUT_BILL_ACCOUNT_CODE;
      line.taxType = this.env.XERO_DEFAULT_TAX_TYPE;

      const inv = new Invoice();
      inv.type = Invoice.TypeEnum.ACCPAY;
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
      inv.dueDate = isoDate(today);
      inv.reference = `payout:${payout.id}`;
      inv.status = Invoice.StatusEnum.AUTHORISED;
      inv.currencyCode = CurrencyCode.GBP;

      const invoicesBody = new Invoices();
      invoicesBody.invoices = [inv];

      const created = await xero.accountingApi.createInvoices(
        tenantId,
        invoicesBody,
        false,
        undefined,
        `payout-bill-${payout.id}`,
      );
      const createdInv = created.body.invoices?.[0];
      if (!createdInv?.invoiceID) {
        const msg =
          createdInv?.validationErrors?.map((v) => v.message).join("; ") ||
          "Xero did not return a bill id";
        return { ok: false, error: msg };
      }

      await this.payouts.updateXeroBillId(payout.id, createdInv.invoiceID);
      return { ok: true, xeroBillId: createdInv.invoiceID };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { ok: false, error: msg };
    }
  }
}
