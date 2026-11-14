import {
  DELIVERY_BOOKING,
  type DocumentRecord,
  type LineBooking,
  type Projection,
  SHOP_OUTSIDE_UK_DELIVERY_BOOKING,
  bidPaymentGroupSettledPolicy,
  canTryAgain,
  isLockedPeriodReason,
  laxReference,
  parkReasonOf,
  parseLaxReference,
  projectBidPaymentCaptured,
  rebuildShopOutsideUkDelivery,
  resolveParked,
} from "@auction/accounting-domain";
import type {
  AwaitedDocument,
  IAccountingDocumentBrowser,
  IAccountingDocumentLookup,
  IAccountingDocumentTransitions,
  IAccountingReleaseBasisReader,
  IBidAccountingFactsReader,
  IPartFundedTransfersReader,
  IShopDeliveryReader,
  PartFundedTransfer,
  ReleaseBasis,
  StoredAccountingDocument,
} from "@auction/persistence/interfaces";
import {
  ACCOUNTING_ORGANISATIONS,
  ACCOUNTING_RELEASE_CHANGED_TEXT,
  ACCOUNTING_RELEASE_INVOICE_CANCELLED_TEXT,
  ACCOUNTING_RELEASE_UNRESOLVED_TEXT,
  type AccountingPartFundedTransfer,
  type AccountingQueuePage,
  type AccountingQueueRow,
  type AccountingReleaseResult,
  type AccountingTryAgainResult,
  accountingDocumentLabel,
  accountingProblemCode,
  accountingProblemText,
  accountingTotalsMismatchText,
} from "@auction/types";
import type {
  AccountingQueueRequest,
  AccountingReleaseRequest,
  AccountingReleaseResponse,
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
  /** The stored Bid rows a parked document is rebuilt from when staff release it. */
  facts: IBidAccountingFactsReader;
  /** Reads the invoices a released payment is applied to. */
  lookup: IAccountingDocumentLookup;
  /**
   * The rows a release is decided on, read before deciding; the move re-reads them under lock and
   * refuses if they changed, so a release is atomic with what it was decided on.
   */
  releaseBasis: IAccountingReleaseBasisReader;
  /** How delivery is booked; `DELIVERY_BOOKING` unless a test says otherwise. */
  deliveryBooking?: LineBooking | null;
  /**
   * A paid Shop order's stored delivery, a parked outside-UK delivery invoice is rebuilt from.
   * Without it a Shop document is never released (refused as not rebuilt).
   */
  shopDelivery?: IShopDeliveryReader;
  /** How Shop delivery outside the UK is booked; `SHOP_OUTSIDE_UK_DELIVERY_BOOKING` unless a test says otherwise. */
  shopOutsideUkBooking?: LineBooking | null;
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
    // What each queued document still waits for, so a waiting payment says which invoice it is.
    const awaited = await this.deps.browser.awaitedOf(page.documents);
    return {
      tab: request.tab,
      organisation: request.organisation,
      reference: request.reference,
      rows: page.documents.map((document) =>
        this.toRow(document, request.canAct, awaited.get(document.id) ?? []),
      ),
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

  /**
   * Release a parked document whose reason is settled: rebuild it from the stored Bid rows with the
   * policy that parked it, as it stands now (`resolveParked`), and queue it under the same LAX
   * reference only if that projection no longer parks it. A delivery invoice's draft is replaced
   * by the rebuilt invoice; anything else must come out exactly as stored. A payment is not
   * released while an invoice it pays was cancelled in Accounting (it could never be sent).
   */
  async release(request: AccountingReleaseRequest): Promise<AccountingReleaseResponse> {
    const found = await this.deps.browser.findById(request.documentId);
    if (!found.ok) {
      return { ok: false, refusal: "unreadable", message: "This document could not be read." };
    }
    const document = found.value;
    if (!document) {
      return { ok: false, refusal: "not_found", message: "There is no such document." };
    }
    if (ALREADY_QUEUED.has(document.record.status)) {
      return { ok: true, value: released(document, "already_queued", false) };
    }
    const { record } = document;
    const reason = record.status === "needs_review" ? parkReasonOf(record.reason) : null;
    if (reason === null) return notParked();

    // What the decision rests on, read first: the move refuses if it reads differently later.
    const basisOf = await this.basisOf(document);
    const basisRead = basisOf === null ? null : await this.deps.releaseBasis.read(basisOf);
    if (basisOf === null || basisRead === null) return unresolved(ACCOUNTING_RELEASE_CHANGED_TEXT);

    const rebuilt = await this.rebuild(document);
    if (rebuilt === null) return unresolved(ACCOUNTING_RELEASE_CHANGED_TEXT);
    const resolved = resolveParked({ document: document.document, reason }, rebuilt);
    if (!resolved.ok) {
      return unresolved(
        resolved.refusal.code === "unresolved"
          ? ACCOUNTING_RELEASE_UNRESOLVED_TEXT[reason]
          : ACCOUNTING_RELEASE_CHANGED_TEXT,
      );
    }
    if (await this.paysCancelledInvoice(document)) {
      return unresolved(ACCOUNTING_RELEASE_INVOICE_CANCELLED_TEXT);
    }

    const moved = await this.deps.transitions.apply(document.id, {
      action: "release",
      requestedBy: request.actorUserId,
      ...(resolved.value.rebuilt ? { document: resolved.value.document } : {}),
      basis: { of: basisOf, read: basisRead },
    });
    if (!moved.ok) {
      // The rows changed between the decision and the move (say the invoice was voided again).
      if (moved.refusal.code === "basis_changed")
        return unresolved(ACCOUNTING_RELEASE_CHANGED_TEXT);
      const now = await this.deps.browser.findById(document.id);
      if (now.ok && now.value && ALREADY_QUEUED.has(now.value.record.status)) {
        return { ok: true, value: released(now.value, "already_queued", false) };
      }
      return notParked();
    }
    await this.deps.audit.releaseRequested({
      documentId: document.id,
      actorUserId: request.actorUserId,
      payload: {
        reference: document.reference,
        documentType: document.kind,
        product: document.product,
        organisation: document.legalEntity,
        parked: reason,
        rebuilt: resolved.value.rebuilt,
      },
    });
    return { ok: true, value: released(moved.value, "released", resolved.value.rebuilt) };
  }

  /**
   * The stored rows a parked document's release is decided on: a Shop order's delivery, a "Pay
   * several" group (its payment or delivery invoice), or a single payment and its invoice. Null
   * when its reference names none of these (it is never released).
   */
  private async basisOf(document: StoredAccountingDocument): Promise<ReleaseBasis | null> {
    const ref = parseLaxReference(document.reference);
    if (!ref.ok) return null;
    const { product, kind, sourceId } = ref.value;
    if (product === "shop") {
      const orderId = /^(.+)-delivery$/.exec(sourceId)?.[1];
      return kind === "invoice" && orderId ? { kind: "shop_order", orderId } : null;
    }
    if (product !== "bid") return null;
    if (kind === "invoice" && sourceId.startsWith(DELIVERY_PREFIX)) {
      const groupId = await this.deps.facts.deliveryGroupOf(sourceId.slice(DELIVERY_PREFIX.length));
      return groupId === null ? null : { kind: "bid_payment_group", groupId };
    }
    if (kind === "payment" && sourceId.startsWith(GROUP_PREFIX)) {
      return { kind: "bid_payment_group", groupId: sourceId.slice(GROUP_PREFIX.length) };
    }
    if (kind === "payment") return { kind: "bid_payment", paymentId: sourceId };
    return null;
  }

  /**
   * The parked document's flow, projected again from the stored rows as they are now: a "Pay
   * several" payment or delivery invoice from its group, a single payment from its payment row.
   * Null when the rows no longer make a projection (the document cannot be rebuilt).
   */
  private async rebuild(document: StoredAccountingDocument): Promise<Projection | null> {
    const ref = parseLaxReference(document.reference);
    if (ref.ok && ref.value.product === "shop") return this.rebuildShop(document);
    if (!ref.ok || ref.value.product !== "bid") return null;
    const { kind, sourceId } = ref.value;
    const { facts } = this.deps;
    let groupId: string | null = null;
    if (kind === "invoice" && sourceId.startsWith(DELIVERY_PREFIX)) {
      groupId = await facts.deliveryGroupOf(sourceId.slice(DELIVERY_PREFIX.length));
    } else if (kind === "payment" && sourceId.startsWith(GROUP_PREFIX)) {
      groupId = sourceId.slice(GROUP_PREFIX.length);
    } else if (kind === "payment" && document.document.kind === "payment") {
      // A single payment: the day it was received is the stored document's own.
      const read = await facts.paymentCaptured(sourceId, noonOf(document.document.receivedOn));
      if (read.status !== "ready") return null;
      const projected = projectBidPaymentCaptured(read.facts);
      return projected.ok ? projected.value : null;
    }
    if (groupId === null) return null;
    const read = await facts.paymentGroupSettled(groupId);
    if (read.status !== "ready") return null;
    const booking =
      this.deps.deliveryBooking === undefined ? DELIVERY_BOOKING : this.deps.deliveryBooking;
    const projected = bidPaymentGroupSettledPolicy(booking)(read.facts);
    return projected.ok ? projected.value : null;
  }

  /**
   * A Shop outside-UK delivery invoice, rebuilt from its order's stored delivery with the booking
   * in force (`SHOP_OUTSIDE_UK_DELIVERY_BOOKING`): while that is not set it is still parked, and
   * the release is refused. Nothing else of the Shop is ever parked, so nothing else is rebuilt.
   */
  private async rebuildShop(document: StoredAccountingDocument): Promise<Projection | null> {
    const draft = document.document;
    const reader = this.deps.shopDelivery;
    const orderId = /^LAX-SHOP-INV-(.+)-delivery$/.exec(document.reference)?.[1];
    if (!reader || draft.kind !== "invoice" || !orderId) return null;
    const read = await reader.delivery(orderId);
    if (read.status !== "ready") return null;
    const booking =
      this.deps.shopOutsideUkBooking === undefined
        ? SHOP_OUTSIDE_UK_DELIVERY_BOOKING
        : this.deps.shopOutsideUkBooking;
    const projected = rebuildShopOutsideUkDelivery(draft, read.facts, booking);
    return projected.ok ? projected.value : null;
  }

  /** A payment applied to an invoice that is cancelled in the same books can never be sent. */
  private async paysCancelledInvoice(document: StoredAccountingDocument): Promise<boolean> {
    if (document.document.kind !== "payment") return false;
    for (const allocation of document.document.allocations) {
      const invoice = await this.deps.lookup.findByReference(
        document.product,
        allocation.invoiceReference,
        document.target,
      );
      if (invoice.ok && invoice.value?.record.status === "cancelled") return true;
    }
    return false;
  }

  private alreadyQueued(document: StoredAccountingDocument): AccountingTryAgainResponse {
    return { ok: true, value: result(document, "already_queued") };
  }

  private toRow(
    document: StoredAccountingDocument,
    canAct: boolean,
    waitingFor: readonly AwaitedDocument[],
  ): AccountingQueueRow {
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
      waitingFor: waitingFor.map((a) => ({ reference: a.reference, state: a.state })),
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
      canRelease:
        canAct && record.status === "needs_review" && parkReasonOf(record.reason) !== null,
    };
  }
}

function result(
  document: StoredAccountingDocument,
  outcome: AccountingTryAgainResult["outcome"],
): AccountingTryAgainResult {
  return { id: document.id, reference: document.reference, outcome };
}

/** Source ids of the documents a "Pay several" payment makes (see the Bid payments policy). */
const GROUP_PREFIX = "grp-";
const DELIVERY_PREFIX = "dlv-";

/** Midday UTC of a London calendar day: the same day in London whatever the season. */
function noonOf(day: string): Date {
  return new Date(`${day}T12:00:00Z`);
}

function released(
  document: StoredAccountingDocument,
  outcome: AccountingReleaseResult["outcome"],
  rebuilt: boolean,
): AccountingReleaseResult {
  return { id: document.id, reference: document.reference, outcome, rebuilt };
}

function unresolved(message: string): AccountingReleaseResponse {
  return { ok: false, refusal: "unresolved", message };
}

function notParked(): AccountingReleaseResponse {
  return {
    ok: false,
    refusal: "not_allowed",
    message: "This document is not parked, so there is nothing to release.",
  };
}

function notAllowed(): AccountingTryAgainResponse {
  return {
    ok: false,
    refusal: "not_allowed",
    message:
      "This document cannot be tried again now. It may already be in Books, or Books must be checked first.",
  };
}
