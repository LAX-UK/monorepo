import type { ILegalEntityRepository } from "@auction/persistence/interfaces";
import type {
  IPaymentExternalRefRepository,
  IXeroConnectionRepository,
} from "@auction/persistence/interfaces";
import type { Redis } from "ioredis";
import type { XeroClient } from "xero-node";
import type { Env } from "../../env.js";
import type { IErrorReporter } from "../interfaces/error-handling.js";
import type {
  IInvoiceAccountingProvider,
  InvoiceAccountingContext,
} from "../interfaces/invoice-accounting.js";
import type { InvoiceAddressingService } from "../invoice-addressing.js";
import { XeroContactSync } from "./xero-contact-sync.js";
import { XeroInvoiceWriter } from "./xero-invoice-writer.js";
import { XeroTokenService, createXeroClientForOAuth, getXeroScopes } from "./xero-token.service.js";

export { createXeroClientForOAuth, getXeroScopes };

export class XeroAccountingProvider implements IInvoiceAccountingProvider {
  private readonly tokens: XeroTokenService;
  private readonly invoices: XeroInvoiceWriter;

  constructor(
    env: Pick<
      Env,
      | "XERO_CLIENT_ID"
      | "XERO_CLIENT_SECRET"
      | "XERO_REDIRECT_URI"
      | "XERO_DEFAULT_REVENUE_ACCOUNT_CODE"
      | "XERO_DEFAULT_TAX_TYPE"
      | "XERO_INVOICE_DUE_DAYS"
      | "XERO_USE_LEGAL_ENTITY_CONTACT"
    >,
    connections: IXeroConnectionRepository,
    externalRefs: IPaymentExternalRefRepository,
    legalEntities: ILegalEntityRepository | null,
    invoiceAddressing: InvoiceAddressingService | null,
    errorReporter: IErrorReporter,
    redis: Redis,
  ) {
    this.tokens = new XeroTokenService(env, connections, errorReporter, redis);
    const contacts = new XeroContactSync(env, legalEntities);
    this.invoices = new XeroInvoiceWriter(
      env,
      connections,
      externalRefs,
      this.tokens,
      contacts,
      invoiceAddressing,
    );
  }

  isConfigured(): boolean {
    return this.tokens.isConfigured();
  }

  ensureInvoiceForPayment(ctx: InvoiceAccountingContext): Promise<{ ok: boolean; error?: string }> {
    return this.invoices.ensureInvoiceForPayment(ctx);
  }

  syncPaymentFromProvider(paymentId: string): Promise<{ ok: boolean; error?: string }> {
    return this.invoices.syncPaymentFromProvider(paymentId);
  }

  syncInvoiceFromProvider(
    tenantId: string,
    invoiceId: string,
  ): Promise<{ ok: boolean; error?: string }> {
    return this.invoices.syncInvoiceFromProvider(tenantId, invoiceId);
  }
}

/** OAuth helpers kept on the facade module for backward-compatible imports. */
export type { XeroClient };
