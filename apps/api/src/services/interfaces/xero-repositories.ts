import type { paymentExternalRef, xeroConnection, xeroWebhookEvent } from "@auction/db/schema";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

export type XeroConnectionRow = InferSelectModel<typeof xeroConnection>;
export type XeroConnectionInsert = InferInsertModel<typeof xeroConnection>;

export type PaymentExternalRefRow = InferSelectModel<typeof paymentExternalRef>;
export type PaymentExternalRefInsert = InferInsertModel<typeof paymentExternalRef>;

export type XeroWebhookEventInsert = InferInsertModel<typeof xeroWebhookEvent>;

export type PaymentExternalSyncStatus = PaymentExternalRefRow["syncStatus"];

export interface IXeroConnectionRepository {
  findLatest(): Promise<XeroConnectionRow | null>;
  upsertConnection(
    row: Omit<XeroConnectionInsert, "id" | "createdAt" | "updatedAt">,
  ): Promise<XeroConnectionRow>;
  updateTokens(
    tenantId: string,
    patch: Pick<XeroConnectionRow, "accessToken" | "refreshToken" | "expiresAt">,
  ): Promise<void>;
  deleteAll(): Promise<void>;
}

export interface IPaymentExternalRefRepository {
  insertPending(paymentId: string): Promise<PaymentExternalRefRow>;
  findByPaymentId(paymentId: string): Promise<PaymentExternalRefRow | null>;
  findByXeroInvoiceId(invoiceId: string): Promise<PaymentExternalRefRow | null>;
  updateSuccess(
    paymentId: string,
    patch: {
      xeroInvoiceId: string;
      xeroInvoiceNumber: string | null;
      xeroContactId: string;
      onlineInvoiceUrl: string;
      syncStatus: PaymentExternalSyncStatus;
    },
  ): Promise<void>;
  updateError(paymentId: string, message: string): Promise<void>;
  updateXeroPaymentId(paymentId: string, xeroPaymentId: string | null): Promise<void>;

  patchOnlineInvoiceUrl(paymentId: string, url: string): Promise<void>;

  updateInvoiceCreated(
    paymentId: string,
    patch: {
      xeroInvoiceId: string;
      xeroInvoiceNumber: string | null;
      xeroContactId: string;
      onlineInvoiceUrl?: string | null;
      syncStatus: PaymentExternalSyncStatus;
    },
  ): Promise<void>;
}

export interface IXeroWebhookEventRepository {
  tryClaimEvent(input: {
    tenantId: string;
    resourceType: string;
    resourceId: string;
    eventKey: string;
  }): Promise<{ claimed: boolean }>;
  markProcessed(eventKey: string): Promise<void>;
  markFailed(eventKey: string, error: string): Promise<void>;
  listRecentFailures(
    limit: number,
  ): Promise<{ tenantId: string; resourceId: string; eventKey: string }[]>;
}
