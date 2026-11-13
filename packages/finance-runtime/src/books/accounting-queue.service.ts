import {
  type DocumentRecord,
  canTryAgain,
  isLockedPeriodReason,
  laxReference,
  parkReasonOf,
} from "@auction/accounting-domain";
import type {
  IAccountingDocumentBrowser,
  IAccountingDocumentTransitions,
  IPartFundedTransfersReader,
  PartFundedTransfer,
  StoredAccountingDocument,
} from "@auction/persistence/interfaces";
import {
  ACCOUNTING_ORGANISATIONS,
  type AccountingPartFundedTransfer,
  type AccountingQueuePage,
  type AccountingQueueRow,
  type AccountingTryAgainResult,
  accountingDocumentLabel,
  accountingProblemCode,
  accountingProblemText,
  accountingTotalsMismatchText,
} from "@auction/types";
import type {
  AccountingQueueRequest,
  AccountingTryAgainRequest,
  AccountingTryAgainResponse,
  BooksDocumentLink,
  IAccountingAuditTrail,
  IAccountingQueueService,
} from "../interfaces/accounting-queue.js";

export type AccountingQueueDeps = {
  browser: IAccountingDocumentBrowser;
  /** Bank transfers part received (Bid): listed for reconciliation, never booked. */
  partFunded: IPartFundedTransfersReader;
  transitions: IAccountingDocumentTransitions;
  audit: IAccountingAuditTrail;
  booksLink: BooksDocumentLink;
};

/** The reason a person reads: why it is waiting for them, or what the provider refused. */
function reasonOf(record: DocumentRecord, lastErrorClass: string | null): string | null {
  if (record.status === "failed" || record.status === "needs_review") return record.reason;
  if (record.status === "pending" || record.status === "unknown") return lastErrorClass;
  return null;
}

/**
 * What staff are told. A totals difference names Books' own figure (ours plus the difference),
 * so the person can see what Books holds without opening it.
 */
function problemText(document: StoredAccountingDocument, reason: string | null): string | null {
  const { record } = document;
  if (record.status === "needs_review" && record.lookup === "clear" && record.mismatch) {
    const { field, differencePence } = record.mismatch;
    return accountingTotalsMismatchText(field, document.totals[field] + differencePence);
  }
  return reason === null ? null : accountingProblemText(reason);
}

function issuedOf(record: DocumentRecord): { number: string; providerId: string } | null {
  if (record.status === "issued") return record.issued;
  if (record.status === "needs_review" && record.lookup === "clear") return record.issued;
  return null;
}

function isOrganisation(value: string): value is AccountingQueueRow["organisation"] {
  return (ACCOUNTING_ORGANISATIONS as readonly string[]).includes(value);
}

const ALREADY_QUEUED = new Set<DocumentRecord["status"]>(["pending", "sending"]);

/** How many part-funded transfers the page lists at most. */
const PART_FUNDED_LIMIT = 50;

/** The LAX reference a part-funded transfer's payment will carry once it is booked. */
function transferReference(transfer: PartFundedTransfer): string {
  const sourceId = transfer.source === "payment_group" ? `grp-${transfer.id}` : transfer.id;
  const reference = laxReference("bid", "payment", sourceId);
  return reference.ok ? reference.value : transfer.id;
}

function toTransfer(transfer: PartFundedTransfer): AccountingPartFundedTransfer {
  return {
    reference: transferReference(transfer),
    paySeveral: transfer.source === "payment_group",
    buyer: transfer.buyer,
    receivedPence: transfer.receivedPence,
    totalPence: transfer.totalPence,
    since: transfer.since ? transfer.since.toISOString() : null,
  };
}

/**
 * Finance › Accounting. Reads the queue tab by tab for both companies or one, and puts a refused
 * document back in the queue when a person asks: the same document, under the same LAX reference.
 * Whether it may be tried again is the life cycle's own rule (`canTryAgain`), so the page and the
 * request can never disagree; a second request for a document already queued changes nothing.
 */
export class AccountingQueueService implements IAccountingQueueService {
  constructor(private readonly deps: AccountingQueueDeps) {}

  async list(request: AccountingQueueRequest): Promise<AccountingQueuePage> {
    const page = await this.deps.browser.list({
      tab: request.tab,
      legalEntity: request.organisation,
      reference: request.reference,
      limit: request.limit,
      offset: request.offset,
    });
    // Bid takes bank transfers; they belong to London Auction Xchange's books.
    const bid = request.organisation === null || request.organisation === "london_auction_xchange";
    const transfers = bid ? await this.deps.partFunded.list(PART_FUNDED_LIMIT) : [];
    return {
      tab: request.tab,
      organisation: request.organisation,
      reference: request.reference,
      rows: page.documents.map((document) => this.toRow(document, request.canAct)),
      total: page.total,
      counts: { ...page.counts },
      issuedToday: page.issuedToday,
      lastSent: page.lastSent
        ? { at: page.lastSent.at.toISOString(), rehearsal: page.lastSent.rehearsal }
        : null,
      limit: request.limit,
      offset: request.offset,
      unreadable: page.unreadable.length,
      canAct: request.canAct,
      partFundedTransfers: transfers.map(toTransfer),
    };
  }

  async tryAgain(request: AccountingTryAgainRequest): Promise<AccountingTryAgainResponse> {
    const found = await this.deps.browser.findById(request.documentId);
    if (!found.ok) {
      return { ok: false, refusal: "unreadable", message: "This document could not be read." };
    }
    const document = found.value;
    if (!document) {
      return { ok: false, refusal: "not_found", message: "There is no such document." };
    }
    if (ALREADY_QUEUED.has(document.record.status)) return this.alreadyQueued(document);
    if (!canTryAgain(document.record)) return notAllowed();

    const moved = await this.deps.transitions.apply(document.id, {
      action: "requeue",
      requestedBy: request.actorUserId,
    });
    if (!moved.ok) {
      // Someone else moved it first: if it is queued now, the request is already met.
      const now = await this.deps.browser.findById(document.id);
      if (now.ok && now.value && ALREADY_QUEUED.has(now.value.record.status)) {
        return this.alreadyQueued(now.value);
      }
      return notAllowed();
    }
    await this.deps.audit.retryRequested({
      documentId: document.id,
      actorUserId: request.actorUserId,
      payload: {
        reference: document.reference,
        documentType: document.kind,
        product: document.product,
        organisation: document.legalEntity,
        fromState: document.record.status,
        reason: accountingProblemCode(reasonOf(document.record, document.lastErrorClass) ?? ""),
      },
    });
    return { ok: true, value: result(moved.value, "requeued") };
  }

  private alreadyQueued(document: StoredAccountingDocument): AccountingTryAgainResponse {
    return { ok: true, value: result(document, "already_queued") };
  }

  private toRow(document: StoredAccountingDocument, canAct: boolean): AccountingQueueRow {
    const { record } = document;
    const reason = reasonOf(record, document.lastErrorClass);
    const issued = issuedOf(record);
    const organisation = document.legalEntity;
    if (!isOrganisation(organisation)) throw new Error(`unknown legal entity ${organisation}`);
    const targetMode = document.target?.mode ?? null;
    return {
      id: document.id,
      reference: document.reference,
      documentType: document.kind,
      label: accountingDocumentLabel(document.kind, document.product, document.reference),
      parked: record.status === "needs_review" ? parkReasonOf(record.reason) : null,
      appliedTo:
        document.document.kind === "payment"
          ? document.document.allocations.map((a) => ({
              reference: a.invoiceReference,
              amountPence: a.amountPence,
            }))
          : [],
      product: document.product,
      organisation,
      state: record.status,
      targetMode,
      grossPence: document.totals.grossPence,
      attempts: record.attempts,
      createdAt: document.createdAt.toISOString(),
      updatedAt: document.updatedAt.toISOString(),
      problem: problemText(document, reason),
      problemCode: reason === null ? null : accountingProblemCode(reason),
      lockedPeriod: record.status === "failed" && isLockedPeriodReason(record.reason),
      books:
        issued === null
          ? null
          : {
              number: issued.number,
              id: issued.providerId,
              url: this.deps.booksLink({
                organisation,
                documentType: document.kind,
                targetMode,
                booksId: issued.providerId,
              }),
            },
      canTryAgain: canAct && canTryAgain(record),
    };
  }
}

function result(
  document: StoredAccountingDocument,
  outcome: AccountingTryAgainResult["outcome"],
): AccountingTryAgainResult {
  return { id: document.id, reference: document.reference, outcome };
}

function notAllowed(): AccountingTryAgainResponse {
  return {
    ok: false,
    refusal: "not_allowed",
    message:
      "This document cannot be tried again now. It may already be in Books, or Books must be checked first.",
  };
}
