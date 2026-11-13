import {
  type AccountingDocument,
  type DocumentRecord,
  type DocumentTarget,
  MAX_SEND_ATTEMPTS,
  type Result,
  type SwitchConfig,
  type Totals,
  applyLookup,
  cancel,
  completeSending,
  documentTarget,
  documentsAwaited,
  escalate,
  expectedTotals,
  expireLease,
  newRecord,
  ok,
  parkedRecord,
  refuse,
  requeue,
  retryDelayMs,
  startSending,
  withhold,
} from "@auction/accounting-domain";
import type {
  ClaimRequest,
  DocumentTransition,
  DueWork,
  DueWorkRequest,
  IAccountingDocumentDueWork,
  IAccountingDocumentRegistry,
  IAccountingDocumentTransitions,
  IAccountingDocumentWorkQueue,
  IAccountingSourceSettingReader,
  RegisterInput,
  RegisterOutcome,
  StoredAccountingDocument,
  TransitionCode,
} from "@auction/persistence/interfaces";

interface Row {
  stored: StoredAccountingDocument;
  updatedAtMs: number;
  history: { action: string; detail: Record<string, unknown> }[];
}

const BOOKS_OFF: SwitchConfig = {
  bid: { xero: "live", books: "off" },
  shop: { xero: "off", books: "off" },
  lax_art: { xero: "off", books: "off" },
};

/**
 * The accounting tables held in memory, following the same rules as the Drizzle repositories:
 * every move goes through the domain's life cycle, a document is aimed once at the switch's target,
 * claims honour the target and the modes asked for, an expired lease becomes unknown, and due work
 * follows `retryDelayMs`. For sender and projector tests; the database tests prove the SQL.
 */
export class InMemoryAccountingStore
  implements
    IAccountingDocumentRegistry,
    IAccountingDocumentWorkQueue,
    IAccountingDocumentDueWork,
    IAccountingDocumentTransitions,
    IAccountingSourceSettingReader
{
  nowMs = Date.parse("2031-03-01T10:00:00Z");
  config: SwitchConfig = BOOKS_OFF;
  claims = 0;
  private readonly rows = new Map<string, Row>();
  private seq = 0;

  setBooks(mode: SwitchConfig["bid"]["books"], xero: SwitchConfig["bid"]["xero"] = "off"): void {
    this.config = {
      bid: { xero, books: mode },
      shop: { xero: "off", books: mode },
      lax_art: { xero: "off", books: mode },
    };
  }

  documents(): StoredAccountingDocument[] {
    return [...this.rows.values()].map((r) => r.stored);
  }

  /**
   * The document for a reference and target (null: the row with none). Without a target, the one
   * created last: a reference is held once per target, as in the database.
   */
  byReference(
    reference: string,
    target?: DocumentTarget | null,
  ): StoredAccountingDocument | undefined {
    return this.rowFor(reference, target)?.stored;
  }

  historyOf(reference: string, target?: DocumentTarget | null): Row["history"] {
    return this.rowFor(reference, target)?.history ?? [];
  }

  private rowFor(reference: string, target?: DocumentTarget | null): Row | undefined {
    return [...this.rows.values()]
      .filter(
        (r) =>
          r.stored.reference === reference &&
          (target === undefined || sameTarget(r.stored.target, target)),
      )
      .at(-1);
  }

  async read(): Promise<Result<SwitchConfig, never>> {
    return ok(this.config);
  }

  async register(input: RegisterInput): Promise<Result<RegisterOutcome, "reference_in_use">> {
    const target = documentTarget(this.config[input.document.product]);
    const existing = this.byReference(input.document.reference, target);
    if (existing) {
      return JSON.stringify(existing.document) === JSON.stringify(input.document)
        ? ok({ created: false, stored: existing })
        : refuse("reference_in_use", "that reference holds a different document");
    }
    this.seq += 1;
    const id = `doc-${this.seq}`;
    const document: AccountingDocument = input.document;
    const stored: StoredAccountingDocument = {
      id,
      product: document.product,
      legalEntity: document.entity,
      kind: document.kind,
      reference: document.reference,
      sourceEventRef: input.sourceEventRef,
      document,
      totals: expectedTotals(document),
      provider: null,
      target,
      record: input.park
        ? parkedRecord(document.kind, document.reference, input.park)
        : newRecord(document.kind, document.reference),
      lastErrorClass: null,
      createdAt: new Date(this.nowMs + this.seq),
      updatedAt: new Date(this.nowMs),
    };
    this.rows.set(id, { stored, updatedAtMs: this.nowMs, history: [] });
    return ok({ created: true, stored });
  }

  async claimNext(
    request: ClaimRequest,
  ): Promise<Result<StoredAccountingDocument | null, TransitionCode>> {
    this.claims += 1;
    for (const row of this.rows.values()) {
      const { record } = row.stored;
      if (record.status === "sending" && this.nowMs >= record.lease.expiresAtMs) {
        const lapsed = expireLease(record, this.nowMs);
        if (lapsed.ok) this.move(row, "expire_lease", lapsed.value, {});
      }
    }
    const candidates = [...this.rows.values()]
      .filter((row) => {
        const { target, record } = row.stored;
        return (
          record.status === "pending" &&
          target !== null &&
          target.provider === request.provider &&
          request.targetModes.includes(target.mode) &&
          this.config[row.stored.product][request.provider] === target.mode &&
          // As the work queue: a payment waits until its invoices are issued for its target.
          documentsAwaited(row.stored.document).every(
            (reference) => this.byReference(reference, target)?.record.status === "issued",
          )
        );
      })
      .sort((a, b) => a.stored.createdAt.getTime() - b.stored.createdAt.getTime());
    const row = candidates[0];
    if (!row) return ok(null);
    const lease = { token: request.leaseToken, expiresAtMs: this.nowMs + request.leaseMs };
    const next = startSending(row.stored.record, lease, this.nowMs);
    if (!next.ok) return next;
    row.stored = { ...row.stored, provider: request.provider };
    this.move(row, "start_sending", next.value, {});
    return ok(row.stored);
  }

  async holdsLease(documentId: string, leaseToken: string, minRemainingMs: number) {
    const record = this.rows.get(documentId)?.stored.record;
    return (
      record?.status === "sending" &&
      record.lease.token === leaseToken &&
      record.lease.expiresAtMs > this.nowMs + minRemainingMs
    );
  }

  async listDue(request: DueWorkRequest): Promise<DueWork> {
    const waited = (attempts: number, sinceMs: number) =>
      attempts >= MAX_SEND_ATTEMPTS
        ? sinceMs <= this.nowMs
        : sinceMs <= this.nowMs - retryDelayMs(attempts);
    const documents = [...this.rows.values()]
      .filter((row) => {
        const { target, record } = row.stored;
        if (target?.provider !== request.provider) return false;
        if (!request.targetModes.includes(target.mode)) return false;
        if (record.status === "unknown") return waited(record.attempts, record.settlesAtMs);
        if (record.status !== "failed") return false;
        const transient = request.transientErrorPrefixes.some((p) => record.reason.startsWith(p));
        return transient && waited(record.attempts, row.updatedAtMs);
      })
      .slice(0, request.limit)
      .map((row) => row.stored);
    return { documents, unreadable: [] };
  }

  async apply(
    documentId: string,
    transition: DocumentTransition,
  ): Promise<Result<StoredAccountingDocument, TransitionCode>> {
    const row = this.rows.get(documentId);
    if (!row) return refuse("not_found", "no such document");
    const next = this.decide(row.stored.record, transition, row.stored.totals);
    if (!next.ok) return next;
    if (next.value === row.stored.record) return ok(row.stored);
    const detail =
      "outcome" in transition && "totals" in transition.outcome
        ? { providerTotals: transition.outcome.totals, expectedTotals: row.stored.totals }
        : {};
    // As the store does: a withheld send is an escalation in the history.
    this.move(
      row,
      transition.action === "withhold" ? "escalate" : transition.action,
      next.value,
      detail,
    );
    return ok(row.stored);
  }

  private decide(record: DocumentRecord, transition: DocumentTransition, expected: Totals) {
    switch (transition.action) {
      case "expire_lease":
        return expireLease(record, this.nowMs);
      case "complete_sending":
        return completeSending(
          record,
          transition.leaseToken,
          transition.outcome,
          this.nowMs,
          expected,
        );
      case "apply_lookup":
        return applyLookup(record, transition.outcome, this.nowMs, expected);
      case "escalate":
        return escalate(record, transition.reason);
      case "withhold":
        return withhold(record, transition.leaseToken, transition.reason);
      case "requeue":
        return requeue(record);
      case "cancel":
        return cancel(record);
    }
  }

  private move(
    row: Row,
    action: string,
    next: DocumentRecord,
    detail: Record<string, unknown>,
  ): void {
    row.stored = {
      ...row.stored,
      record: next,
      lastErrorClass: next.status === "failed" ? next.reason : row.stored.lastErrorClass,
      updatedAt: new Date(this.nowMs),
    };
    row.updatedAtMs = this.nowMs;
    row.history.push({ action, detail });
  }
}

function sameTarget(a: DocumentTarget | null, b: DocumentTarget | null): boolean {
  return a?.provider === b?.provider && a?.mode === b?.mode;
}
