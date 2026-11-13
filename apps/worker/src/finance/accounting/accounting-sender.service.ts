import {
  type DestinationBinding,
  type IssueOutcome,
  type LookupOutcome,
  type SwitchConfig,
  type TargetMode,
  attemptsExhausted,
  booksTargetMode,
  checkDestination,
} from "@auction/accounting-domain";
import type {
  IAccountingDocumentDueWork,
  IAccountingDocumentTransitions,
  IAccountingDocumentWorkQueue,
  IAccountingSourceSettingReader,
  StoredAccountingDocument,
} from "@auction/persistence/interfaces";
import { type SenderPorts, sendThrough } from "./accounting-dispatch.js";

/** Plan: two minutes; any provider call must time out well inside it. */
export const SENDER_LEASE_MS = 2 * 60_000;
const DEFAULT_BATCH = 25;

export interface AccountingSenderLog {
  info(details: Record<string, unknown>, message: string): void;
  warn(details: Record<string, unknown>, message: string): void;
}

export interface AccountingSenderDeps {
  readonly workQueue: IAccountingDocumentWorkQueue;
  readonly dueWork: IAccountingDocumentDueWork;
  readonly transitions: IAccountingDocumentTransitions;
  readonly settings: IAccountingSourceSettingReader;
  /** The Books ports per target mode this sender can serve; a mode not here is never claimed. */
  readonly portsByMode: Readonly<Partial<Record<TargetMode, SenderPorts>>>;
  /**
   * The Books organisation each writing mode may send each product's documents to. A document
   * whose adapter would call any other organisation (or, in dry run, any organisation at all) is
   * never sent: it goes to a person.
   */
  readonly destinations: DestinationBinding;
  readonly transientErrorPrefixes: readonly string[];
  readonly newLeaseToken: () => string;
  readonly log: AccountingSenderLog;
  readonly batch?: number;
}

export interface SenderTick {
  readonly active: boolean;
  readonly sent: number;
  readonly lookedUp: number;
  readonly requeued: number;
  readonly escalated: number;
}

const IDLE: SenderTick = { active: false, sent: 0, lookedUp: 0, requeued: 0, escalated: 0 };

/**
 * Sends queued accounting documents to Books, one lease at a time, and records every answer
 * through the document's life cycle. Each tick it first settles what is due (an unknown outcome is
 * looked up before anything is sent again; a passing refusal is requeued after its wait), then
 * claims and sends. A document that has used every attempt goes to a person. It only ever claims
 * documents aimed at a mode it has ports for, so a rehearsal sender cannot touch a test or live
 * document, and with no product aimed at Books it does nothing.
 *
 * Before any call for a document (a send or a lookup) it checks where the adapter would make it:
 * a mode is bound to an organisation id, not trusted as a label. A document whose adapter would
 * reach another organisation is not sent or looked up, and goes to a person with the reason.
 */
export class AccountingSender {
  private readonly modes: readonly TargetMode[];
  private readonly batch: number;

  constructor(private readonly deps: AccountingSenderDeps) {
    this.modes = (Object.keys(deps.portsByMode) as TargetMode[]).filter(
      (mode) => deps.portsByMode[mode] !== undefined,
    );
    this.batch = deps.batch ?? DEFAULT_BATCH;
  }

  async tick(): Promise<SenderTick> {
    if (!(await this.isActive())) return IDLE;
    const settled = await this.settleDue();
    let sent = 0;
    while (sent < this.batch) {
      const token = this.deps.newLeaseToken();
      const claimed = await this.deps.workQueue.claimNext({
        provider: "books",
        leaseToken: token,
        leaseMs: SENDER_LEASE_MS,
        targetModes: this.modes,
      });
      if (!claimed.ok) {
        this.deps.log.warn({ code: claimed.refusal.code }, "accounting_sender_claim_refused");
        break;
      }
      if (claimed.value === null) break;
      await this.send(claimed.value, token);
      sent += 1;
    }
    return { active: true, sent, ...settled };
  }

  private async isActive(): Promise<boolean> {
    if (this.modes.length === 0) return false;
    const config = await this.deps.settings.read();
    if (!config.ok) {
      this.deps.log.warn({ code: config.refusal.code }, "accounting_sender_switch_unreadable");
      return false;
    }
    return this.aimsAtServedMode(config.value);
  }

  /**
   * Is some product aimed at Books in a mode this sender serves? The projector's rule
   * (`booksTargetMode`), so the sender is active exactly when the projector queues for it. Work
   * left for a mode Books is no longer aimed at waits, untouched, until it is aimed there again.
   */
  private aimsAtServedMode(config: SwitchConfig): boolean {
    return Object.values(config).some((product) => {
      const mode = booksTargetMode(product);
      return mode !== null && this.modes.includes(mode);
    });
  }

  private portsFor(document: StoredAccountingDocument): SenderPorts | undefined {
    const mode = document.target?.mode;
    return mode === undefined ? undefined : this.deps.portsByMode[mode];
  }

  /** Why the document must not be handed to `ports`, or null when it goes where it is bound. */
  private wrongDestination(document: StoredAccountingDocument, ports: SenderPorts): string | null {
    const mode = document.target?.mode;
    if (mode === undefined) return "accounting_no_target";
    let destination: ReturnType<SenderPorts["destination"]["destinationFor"]>;
    try {
      destination = ports.destination.destinationFor(document.product);
    } catch (error) {
      return `destination_unresolved: ${errorName(error)}`;
    }
    const checked = checkDestination(mode, document.product, destination, this.deps.destinations);
    return checked.ok ? null : `${checked.refusal.code}: ${checked.refusal.message}`;
  }

  /**
   * Leave a claimed document that must not be sent with a person: recorded as refused (nothing was
   * sent), then escalated at once, so it is never requeued and sent on its own.
   */
  private async holdUnsent(
    document: StoredAccountingDocument,
    token: string,
    reason: string,
  ): Promise<void> {
    this.deps.log.warn(
      { documentId: document.id, mode: document.target?.mode, reason },
      "accounting_sender_wrong_destination",
    );
    const refused = await this.apply(document, {
      action: "complete_sending",
      leaseToken: token,
      outcome: { status: "rejected", reason },
    });
    if (refused) await this.apply(document, { action: "escalate", reason });
  }

  private async send(document: StoredAccountingDocument, token: string): Promise<void> {
    const ports = this.portsFor(document);
    const wrong = ports ? this.wrongDestination(document, ports) : null;
    if (wrong !== null) return this.holdUnsent(document, token, wrong);
    let outcome: IssueOutcome;
    if (!ports) {
      // Cannot happen through the claim (it filters by mode); refused so it is never left leased.
      outcome = { status: "rejected", reason: "accounting_no_adapter_for_mode" };
    } else {
      try {
        outcome = await sendThrough(ports, document.document);
      } catch (error) {
        // The request may have left: the outcome is unknown and a lookup decides.
        this.deps.log.warn(
          { documentId: document.id, err: errorName(error) },
          "accounting_sender_send_threw",
        );
        outcome = { status: "unknown", detail: "sender_error" };
      }
    }
    const done = await this.deps.transitions.apply(document.id, {
      action: "complete_sending",
      leaseToken: token,
      outcome,
    });
    if (!done.ok) {
      this.deps.log.warn(
        { documentId: document.id, code: done.refusal.code },
        "accounting_sender_complete_refused",
      );
      return;
    }
    this.deps.log.info(
      {
        documentId: document.id,
        reference: document.reference,
        mode: document.target?.mode,
        outcome: outcome.status,
        state: done.value.record.status,
      },
      "accounting_sender_sent",
    );
  }

  private async settleDue(): Promise<Omit<SenderTick, "active" | "sent">> {
    const due = await this.deps.dueWork.listDue({
      provider: "books",
      targetModes: this.modes,
      transientErrorPrefixes: this.deps.transientErrorPrefixes,
      limit: this.batch,
    });
    for (const id of due.unreadable) {
      this.deps.log.warn({ documentId: id }, "accounting_sender_unreadable_document");
    }
    let lookedUp = 0;
    let requeued = 0;
    let escalated = 0;
    for (const document of due.documents) {
      const step = await this.settle(document);
      if (step === "looked_up") lookedUp += 1;
      if (step === "requeued") requeued += 1;
      if (step === "escalated") escalated += 1;
    }
    return { lookedUp, requeued, escalated };
  }

  private async settle(
    document: StoredAccountingDocument,
  ): Promise<"looked_up" | "requeued" | "escalated" | "none"> {
    const { record } = document;
    if (record.status !== "unknown" && record.status !== "failed") return "none";
    if (attemptsExhausted(record.attempts)) {
      const reason =
        record.status === "unknown"
          ? `no answer after ${record.attempts} attempts; look it up before anything else`
          : `refused ${record.attempts} times: ${record.reason}`;
      return (await this.apply(document, { action: "escalate", reason })) ? "escalated" : "none";
    }
    if (record.status === "failed") {
      return (await this.apply(document, { action: "requeue" })) ? "requeued" : "none";
    }
    const ports = this.portsFor(document);
    if (!ports) return "none";
    // A lookup in the wrong organisation could adopt a stranger's document as ours.
    const wrong = this.wrongDestination(document, ports);
    if (wrong !== null) {
      this.deps.log.warn(
        { documentId: document.id, mode: document.target?.mode, reason: wrong },
        "accounting_sender_wrong_destination",
      );
      return (await this.apply(document, { action: "escalate", reason: wrong }))
        ? "escalated"
        : "none";
    }
    let outcome: LookupOutcome;
    try {
      // Read back against the document, so a differing one goes to a person even when the
      // answer to its send never reached the record (a swept lease, a lost reply).
      outcome = await ports.lookup.findDocument(document.document);
    } catch (error) {
      // A lookup that could not be made settles nothing; the document stays unknown.
      outcome = { status: "unavailable", reason: errorName(error) };
    }
    return (await this.apply(document, { action: "apply_lookup", outcome })) ? "looked_up" : "none";
  }

  private async apply(
    document: StoredAccountingDocument,
    transition: Parameters<IAccountingDocumentTransitions["apply"]>[1],
  ): Promise<boolean> {
    const done = await this.deps.transitions.apply(document.id, transition);
    if (!done.ok) {
      // Another worker moved it first, or the lookup came too early: nothing to do this tick.
      this.deps.log.info(
        { documentId: document.id, action: transition.action, code: done.refusal.code },
        "accounting_sender_step_skipped",
      );
      return false;
    }
    return true;
  }
}

function errorName(error: unknown): string {
  return error instanceof Error ? error.name : "unknown";
}
