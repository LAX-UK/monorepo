import type { paymentExternalRef, xeroConnection, xeroWebhookEvent } from "@auction/db/schema";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

type XeroConnectionStoredRow = InferSelectModel<typeof xeroConnection>;
/** The stored token columns (plaintext legacy and sealed), which callers never see. */
type XeroConnectionTokenStorage =
  | "accessToken"
  | "refreshToken"
  | "accessTokenSealed"
  | "refreshTokenSealed";

/** A connection with its OAuth tokens opened. The sealed storage columns stay in the repository. */
export type XeroConnectionRow = Omit<XeroConnectionStoredRow, XeroConnectionTokenStorage> & {
  accessToken: string;
  refreshToken: string;
};
/**
 * A connection as a status read sees it: never the tokens, only whether they can still be opened.
 * `tokensReadable: false` means the stored tokens were sealed without the current key (or with
 * another one) and the connection must be made again before anything can be sent to Xero.
 */
export type XeroConnectionSummaryRow = Omit<XeroConnectionRow, "accessToken" | "refreshToken"> & {
  tokensReadable: boolean;
};
export type XeroConnectionInsert = Omit<
  InferInsertModel<typeof xeroConnection>,
  XeroConnectionTokenStorage
> & { accessToken: string; refreshToken: string };

export type PaymentExternalRefRow = InferSelectModel<typeof paymentExternalRef>;
export type PaymentExternalRefInsert = InferInsertModel<typeof paymentExternalRef>;

export type XeroWebhookEventInsert = InferInsertModel<typeof xeroWebhookEvent>;

export type PaymentExternalSyncStatus = PaymentExternalRefRow["syncStatus"];
export type XeroConnectionStatus = XeroConnectionRow["connectionStatus"];

export interface IXeroConnectionRepository {
  /** The latest connection with its tokens opened; throws when they cannot be opened. */
  findLatest(): Promise<XeroConnectionRow | null>;
  /** The latest connection for reporting state only; never throws on unreadable tokens. */
  findLatestSummary(): Promise<XeroConnectionSummaryRow | null>;
  upsertConnection(
    row: Omit<XeroConnectionInsert, "id" | "createdAt" | "updatedAt">,
  ): Promise<XeroConnectionRow>;
  updateTokens(
    tenantId: string,
    patch: Pick<XeroConnectionRow, "accessToken" | "refreshToken" | "expiresAt">,
  ): Promise<void>;
  updateConnectionStatus(
    tenantId: string,
    status: XeroConnectionStatus,
    lastRefreshError: string | null,
  ): Promise<void>;
  updateOrgMetadata(
    tenantId: string,
    patch: Pick<XeroConnectionRow, "orgShortCode" | "orgBaseCurrency">,
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

  countSyncErrors(): Promise<number>;

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
  countErrorsSince(since: Date): Promise<number>;
  listRecentFailures(
    limit: number,
  ): Promise<{ tenantId: string; resourceId: string; eventKey: string }[]>;
}
