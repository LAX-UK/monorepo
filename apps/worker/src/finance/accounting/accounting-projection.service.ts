import {
  type DefaultedInvoiceInBooks,
  type DocumentRecord,
  type DocumentTarget,
  type HeldDocument,
  type Product,
  type SwitchConfig,
  booksTargetMode,
  documentTarget,
  heldReasonCode,
  parkReasonFor,
  whenReferenceHeld,
} from "@auction/accounting-domain";
import type {
  IAccountingCreditNotes,
  IAccountingDocumentLookup,
  IAccountingDocumentRegistry,
  IAccountingDocumentTransitions,
  IAccountingSourceSettingReader,
  IBidAccountingFactsReader,
  IShopAccountingFactsReader,
} from "@auction/persistence/interfaces";
import { ACCOUNTING_ALERTS, type AccountingAlertSink } from "./accounting-alerts.js";
import {
  ACCOUNTING_EVENT_ROUTES,
  type AccountingEvent,
  type AccountingEventRoute,
  type BooksView,
} from "./accounting-event-routes.js";

export type ProjectionOutcome =
  | { readonly outcome: "skipped"; readonly reason: string }
  | {
      readonly outcome: "projected";
      /** New documents queued for the books. */
      readonly created: number;
      /** Documents already queued with exactly these details (a replay). */
      readonly replayed: number;
      /** Contacts already queued with other details; the queued one stands. */
      readonly kept: number;
      /** New documents stored parked (in "Needs a person"), never sent until that is settled. */
      readonly parked: number;
      /** Documents never sent that this event cancelled (an invoice voided by a buyer default). */
      readonly cancelled: number;
      /**
       * Issued documents this event held for a person (a credit note whose refund was taken back);
       * present only when one was.
       */
      readonly held?: number;
    };

/**
 * An event the books cannot take as it stands: a policy refused it, or a reference is already
 * held by a different document. Not retried: the same facts would be refused again. It goes to
 * the failed deliveries for a person.
 */
export class AccountingProjectionRefusedError extends Error {
  readonly retryable = false;
  constructor(
    readonly code: string,
    detail: string,
  ) {
    super(`accounting_projection_refused:${code}:${detail}`);
    this.name = "AccountingProjectionRefusedError";
  }
}

/**
 * The event cannot be settled yet, but will be: an invoice it cancels or credits is being sent, a
 * credit note raced another for the same invoice, a document moved while it was cancelled. Tried
 * again later (with backoff), when the facts are read afresh.
 */
export class AccountingProjectionNotYetError extends Error {
  readonly retryable = true;
  /**
   * A credit note the event must decide on is still being sent, or its outcome is not known yet
   * (`credit_in_flight`): the event waits for it to settle without using up delivery attempts
   * (tried again every `retryAfterMs`), so a reversal is never dead-lettered while it waits.
   */
  readonly waiting: boolean;
  readonly retryAfterMs?: number;
  constructor(
    readonly code: string,
    detail: string,
  ) {
    super(`accounting_projection_not_yet:${code}:${detail}`);
    this.name = "AccountingProjectionNotYetError";
    this.waiting = WAITS_FOR_SETTLING.has(code);
    if (this.waiting) this.retryAfterMs = SETTLING_RETRY_MS;
  }
}

/** Refusals that wait for a document to settle in the books, without using up delivery attempts. */
const WAITS_FOR_SETTLING: ReadonlySet<string> = new Set(["credit_in_flight"]);
/** How often an event waiting for a credit note to settle is tried again. */
const SETTLING_RETRY_MS = 5 * 60_000;

/** Refusals that a later attempt, reading the facts again, can get past. */
const NOT_YET: ReadonlySet<string> = new Set([
  "invoice_in_flight",
  "credit_in_flight",
  "credit_exceeds_invoice",
  "credit_prior_changed",
]);

/** The switch could not be read; try the event again later. */
export class AccountingSwitchUnreadableError extends Error {
  readonly retryable = true;
  constructor(code: string) {
    super(`accounting_switch_unreadable:${code}`);
    this.name = "AccountingSwitchUnreadableError";
  }
}

export type ProjectorActivity = "active" | "inactive" | "unreadable";

export interface AccountingProjectionDeps {
  readonly facts: IBidAccountingFactsReader;
  /** The Shop's order facts; absent where the Shop flow is not wired (it then skips, never guesses). */
  readonly shopFacts?: IShopAccountingFactsReader;
  readonly settings: IAccountingSourceSettingReader;
  readonly registry: IAccountingDocumentRegistry;
  /**
   * What the books already hold, read and moved for the refund and buyer default flows: the
   * documents by reference, an invoice's credit notes, and the cancel of one never sent. Absent
   * where those flows are not wired (their events are then tried again, never guessed).
   */
  readonly books?: {
    readonly lookup: IAccountingDocumentLookup;
    readonly creditNotes: IAccountingCreditNotes;
    readonly transitions: IAccountingDocumentTransitions;
  };
  readonly routes?: Readonly<Record<string, AccountingEventRoute>>;
  /** Where an issued document held for a person is reported (`refund_reversed_after_credit`). */
  readonly alerts?: AccountingAlertSink;
}

/** Where an invoice stands in the books, as a buyer default reads it. */
function standingOf(record: DocumentRecord | null): DefaultedInvoiceInBooks {
  if (record === null) return "absent";
  switch (record.status) {
    case "cancelled":
      return "absent";
    case "pending":
    case "failed":
      return "waiting";
    case "issued":
      return "issued";
    case "sending":
    case "unknown":
      return "in_flight";
    case "needs_review":
      if (record.lookup !== "clear") return "in_flight";
      return record.issued === null ? "waiting" : "held_for_review";
    default:
      return "in_flight";
  }
}

/** No Shop facts reader: every Shop event is skipped, so nothing is booked from a guess. */
const NO_SHOP_FACTS: IShopAccountingFactsReader = {
  orderPaid: async () => ({ status: "skip", reason: "shop_facts_not_wired" }),
};

/** Does the switch aim this product's new documents at Books (in any mode)? Same rule as the sender. */
function aimsAtBooks(config: SwitchConfig, product: Product): boolean {
  return booksTargetMode(config[product]) !== null;
}

/**
 * Turns one business event into accounting documents and queues them: reads the facts the event
 * names, runs the flow's pure policy, and registers each document in order (contact, invoice, then
 * what refers to them). A document the policy parks is stored parked, never queued. Idempotent by
 * LAX reference, so a redelivered event changes nothing.
 * Products whose switch does not aim at Books are skipped: with the switch on Xero, nothing new
 * is written.
 */
export class AccountingProjection {
  private readonly routes: Readonly<Record<string, AccountingEventRoute>>;

  constructor(private readonly deps: AccountingProjectionDeps) {
    this.routes = deps.routes ?? ACCOUNTING_EVENT_ROUTES;
  }

  /** The event types this projection reads. */
  eventTypes(): readonly string[] {
    return Object.keys(this.routes);
  }

  /**
   * Is any product aimed at Books? `inactive` lets the projector move its cursor past the events
   * of the moment (they belong to whatever else books them); `unreadable` says nothing either way,
   * so the projector leaves everything as it is and tries again next tick.
   */
  async activity(): Promise<ProjectorActivity> {
    const config = await this.deps.settings.read();
    if (!config.ok) return "unreadable";
    return Object.values(this.routes).some((r) => aimsAtBooks(config.value, r.product))
      ? "active"
      : "inactive";
  }

  /** Is any product aimed at Books? If not, the projector projects nothing this tick. */
  async isActive(): Promise<boolean> {
    return (await this.activity()) === "active";
  }

  async project(event: AccountingEvent): Promise<ProjectionOutcome> {
    const route = Object.hasOwn(this.routes, event.eventType)
      ? this.routes[event.eventType]
      : undefined;
    if (!route) return { outcome: "skipped", reason: "not_an_accounting_event" };
    const config = await this.deps.settings.read();
    if (!config.ok) throw new AccountingSwitchUnreadableError(config.refusal.code);
    if (!aimsAtBooks(config.value, route.product)) {
      return { outcome: "skipped", reason: "books_not_selected" };
    }
    const target = documentTarget(config.value[route.product]);
    const books = this.booksView(route.product, target);
    const routed = await route.project(
      {
        bid: this.deps.facts,
        shop: this.deps.shopFacts ?? NO_SHOP_FACTS,
        ...(books ? { books } : {}),
      },
      event,
    );
    if (routed.status === "skip") return { outcome: "skipped", reason: routed.reason };
    if (!routed.projection.ok) {
      const { code, message } = routed.projection.refusal;
      if (NOT_YET.has(code)) throw new AccountingProjectionNotYetError(code, message);
      throw new AccountingProjectionRefusedError(code, message);
    }
    let created = 0;
    let replayed = 0;
    let kept = 0;
    let parked = 0;
    const projection = routed.projection.value;
    const { cancelled, creditPence } = await this.cancelNeverSent(
      route.product,
      target,
      projection.cancel ?? [],
    );
    const held = await this.holdIssued(route.product, target, projection.hold ?? [], event);
    // The credit notes cancelled just now no longer count in what the new ones were built after.
    const basis =
      routed.basis && "priorCreditPence" in routed.basis
        ? { ...routed.basis, priorCreditPence: routed.basis.priorCreditPence - creditPence }
        : routed.basis;
    for (const document of projection.documents) {
      const park = parkReasonFor(projection, document.reference);
      const registered = await this.deps.registry.register({
        document,
        sourceEventRef: `domain_event:${event.id}`,
        ...(park ? { park } : {}),
        ...(basis && document.kind === "credit_note" ? { creditBasis: basis } : {}),
      });
      if (registered.ok) {
        if (registered.value.created) created += 1;
        else replayed += 1;
        if (registered.value.created && park) parked += 1;
        continue;
      }
      if (NOT_YET.has(registered.refusal.code)) {
        throw new AccountingProjectionNotYetError(
          registered.refusal.code,
          `${document.reference}: ${registered.refusal.message}`,
        );
      }
      const held =
        registered.refusal.code === "reference_in_use" &&
        whenReferenceHeld(document.kind) === "keep_held";
      if (!held) {
        throw new AccountingProjectionRefusedError(
          registered.refusal.code,
          `${document.reference}: ${registered.refusal.message}`,
        );
      }
      kept += 1;
    }
    return {
      outcome: "projected",
      created,
      replayed,
      kept,
      parked,
      cancelled,
      ...(held > 0 ? { held } : {}),
    };
  }

  /** The books a product's documents go to now (its current target), for the routes to read. */
  private booksView(product: Product, target: DocumentTarget | null): BooksView | null {
    const books = this.deps.books;
    if (!books) return null;
    return {
      creditNotesFor: async (invoiceReference) => {
        const read = await books.creditNotes.creditNotesFor(product, invoiceReference, target);
        if (!read.ok)
          throw new AccountingProjectionRefusedError(read.refusal.code, invoiceReference);
        return read.value;
      },
      invoiceStanding: async (invoiceReference) => {
        const found = await books.lookup.findByReference(product, invoiceReference, target);
        if (!found.ok)
          throw new AccountingProjectionRefusedError(found.refusal.code, invoiceReference);
        return standingOf(found.value?.record ?? null);
      },
      creditStanding: async (creditNoteReference) => {
        const found = await books.lookup.findByReference(product, creditNoteReference, target);
        if (!found.ok)
          throw new AccountingProjectionRefusedError(found.refusal.code, creditNoteReference);
        return standingOf(found.value?.record ?? null);
      },
      awaitCreditRegistrations: (invoiceReference) =>
        this.deps.registry.awaitCreditRegistrations(product, invoiceReference, target),
    };
  }

  /**
   * Holds each named issued document for a person (the Books document kept, nothing undone there)
   * and raises an alert, in the books the product goes to now. One already held for this reason is
   * left as it is (a replay raises nothing again); one held for another reason is held again for
   * this one (its history keeps both), with the alert. One that moved meanwhile is decided again
   * later.
   */
  private async holdIssued(
    product: Product,
    target: DocumentTarget | null,
    held: readonly HeldDocument[],
    event: AccountingEvent,
  ): Promise<number> {
    if (held.length === 0) return 0;
    const books = this.deps.books;
    if (!books) throw new AccountingProjectionNotYetError("books_view_missing", "hold");
    let count = 0;
    for (const { reference, reason } of held) {
      const found = await books.lookup.findByReference(product, reference, target);
      if (!found.ok) throw new AccountingProjectionRefusedError(found.refusal.code, reference);
      const document = found.value;
      const code = heldReasonCode(reason);
      if (!document) throw new AccountingProjectionNotYetError("credit_missing", reference);
      const record = document.record;
      if (record.status === "needs_review" && record.reason === code) continue;
      // Issued, or already held for a person for another reason (Books refused its refund from
      // clearing, its totals differ): held again for this reason, so the person is told the refund
      // was taken back and is not to be refunded by hand.
      const heldAlready =
        record.status === "needs_review" && record.lookup === "clear" && record.issued !== null;
      if (record.status !== "issued" && !heldAlready) {
        throw new AccountingProjectionNotYetError("credit_in_flight", reference);
      }
      const moved = await books.transitions.apply(document.id, { action: "hold", reason: code });
      if (!moved.ok) throw new AccountingProjectionNotYetError(moved.refusal.code, reference);
      count += 1;
      this.deps.alerts?.raise(ACCOUNTING_ALERTS.refundReversedAfterCredit, {
        documentId: document.id,
        reference,
        mode: target?.mode ?? null,
        providerNumber: record.issued?.number ?? null,
        ...(heldAlready ? { heldBefore: record.reason } : {}),
        sourceEvent: `domain_event:${event.id}`,
      });
    }
    return count;
  }

  /**
   * Cancels each named document that was never sent, in the books the product goes to now, and
   * says how much credit the cancelled credit notes held. One already cancelled is left as it is. One that moved on meanwhile (claimed by a sender, issued)
   * is not cancelled: the event is tried again and decided afresh (credited once it is issued).
   */
  private async cancelNeverSent(
    product: Product,
    target: DocumentTarget | null,
    references: readonly string[],
  ): Promise<{ cancelled: number; creditPence: number }> {
    if (references.length === 0) return { cancelled: 0, creditPence: 0 };
    const books = this.deps.books;
    if (!books) throw new AccountingProjectionNotYetError("books_view_missing", "cancel");
    let cancelled = 0;
    let creditPence = 0;
    for (const reference of references) {
      const found = await books.lookup.findByReference(product, reference, target);
      if (!found.ok) throw new AccountingProjectionRefusedError(found.refusal.code, reference);
      const document = found.value;
      if (!document || document.record.status === "cancelled") continue;
      const moved = await books.transitions.apply(document.id, { action: "cancel" });
      if (!moved.ok) {
        throw new AccountingProjectionNotYetError(moved.refusal.code, reference);
      }
      cancelled += 1;
      if (document.kind === "credit_note") creditPence += document.totals.grossPence;
    }
    return { cancelled, creditPence };
  }
}
