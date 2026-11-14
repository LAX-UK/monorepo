import type {
  AccountingOrganisation,
  AccountingQueuePage,
  AccountingQueueTab,
  AccountingReleaseRefusal,
  AccountingReleaseResult,
  AccountingTryAgainRefusal,
  AccountingTryAgainResult,
} from "@auction/types";

export type AccountingQueueRequest = {
  tab: AccountingQueueTab;
  organisation: AccountingOrganisation | null;
  /** An exact LAX reference to find within the tab and company; null for the whole tab. */
  reference: string | null;
  limit: number;
  offset: number;
  /** The person may try documents again; decided by the route from their permissions. */
  canAct: boolean;
};

export type AccountingTryAgainRequest = {
  documentId: string;
  actorUserId: string;
};

export type AccountingTryAgainResponse =
  | { ok: true; value: AccountingTryAgainResult }
  | { ok: false; refusal: AccountingTryAgainRefusal; message: string };

export type AccountingReleaseRequest = AccountingTryAgainRequest;

export type AccountingReleaseResponse =
  | { ok: true; value: AccountingReleaseResult }
  | { ok: false; refusal: AccountingReleaseRefusal; message: string };

/**
 * Finance › Accounting: the documents LAX sends to the books, trying a refused one again, and
 * releasing a parked one once its reason is settled. Both queue the same document under the same
 * LAX reference; asking twice changes nothing more.
 */
export interface IAccountingQueueService {
  list(request: AccountingQueueRequest): Promise<AccountingQueuePage>;
  tryAgain(request: AccountingTryAgainRequest): Promise<AccountingTryAgainResponse>;
  release(request: AccountingReleaseRequest): Promise<AccountingReleaseResponse>;
}

/** Records who asked for a try again or a release, in the staff audit log. */
export interface IAccountingAuditTrail {
  retryRequested(input: {
    documentId: string;
    actorUserId: string;
    payload: Record<string, unknown>;
  }): Promise<void>;
  releaseRequested(input: {
    documentId: string;
    actorUserId: string;
    payload: Record<string, unknown>;
  }): Promise<void>;
}

/** Where a person opens a document in Books; null when there is nowhere to go (a rehearsal). */
export type BooksDocumentLink = (input: {
  organisation: AccountingOrganisation;
  documentType: "invoice" | "payment" | "credit_note" | "bill" | "contact" | "expense" | "transfer";
  targetMode: "dry_run" | "test_org" | "live" | null;
  booksId: string;
}) => string | null;
