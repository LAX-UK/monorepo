import { type DocumentRecord, canTryAgain, isLockedPeriodReason } from "@auction/accounting-domain";
import type {
  IAccountingDocumentBrowser,
  IAccountingDocumentTransitions,
  StoredAccountingDocument,
} from "@auction/persistence/interfaces";
import {
  ACCOUNTING_ORGANISATIONS,
  type AccountingQueuePage,
  type AccountingQueueRow,
  type AccountingTryAgainResult,
  accountingProblemCode,
  accountingProblemText,
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

function issuedOf(record: DocumentRecord): { number: string; providerId: string } | null {
  if (record.status === "issued") return record.issued;
  if (record.status === "needs_review" && record.lookup === "clear") return record.issued;
  return null;
}

function isOrganisation(value: string): value is AccountingQueueRow["organisation"] {
  return (ACCOUNTING_ORGANISATIONS as readonly string[]).includes(value);
}

const ALREADY_QUEUED = new Set<DocumentRecord["status"]>(["pending", "sending"]);

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
      limit: request.limit,
      offset: request.offset,
    });
    return {
      tab: request.tab,
      organisation: request.organisation,
      rows: page.documents.map((document) => this.toRow(document, request.canAct)),
      total: page.total,
      counts: { ...page.counts },
      limit: request.limit,
      offset: request.offset,
      unreadable: page.unreadable.length,
      canAct: request.canAct,
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
      product: document.product,
      organisation,
      state: record.status,
      targetMode,
      grossPence: document.totals.grossPence,
      attempts: record.attempts,
      createdAt: document.createdAt.toISOString(),
      updatedAt: document.updatedAt.toISOString(),
      problem: reason === null ? null : accountingProblemText(reason),
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
