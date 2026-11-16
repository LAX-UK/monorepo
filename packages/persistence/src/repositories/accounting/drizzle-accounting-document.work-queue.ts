import {
  LEGAL_ENTITIES,
  type LegalEntity,
  type Result,
  ok,
  refuse,
  startSending,
} from "@auction/accounting-domain";
import type { Database } from "@auction/db";
import { accountingDocument, accountingSourceSetting } from "@auction/db/schema";
import { type SQL, and, asc, eq, exists, gt, inArray, lte, notInArray, or, sql } from "drizzle-orm";
import type {
  AccountingClock,
  ClaimRequest,
  IAccountingDocumentWorkQueue,
  StoredAccountingDocument,
  StrandedRequest,
  TransitionCode,
} from "../../interfaces/accounting.js";
import { AWAITED_INVOICE_CANCELLED, AWAITED_ISSUED } from "../../lib/accounting-awaited.js";
import { applyLockedTransition, persistMove } from "../../lib/accounting-document-move.js";
import { rowToRecord } from "../../lib/accounting-document-row.js";

/** How many lapsed leases one call settles before it gives up looking for pending work. */
const MAX_LAPSED_PER_CLAIM = 100;

type Step =
  | { kind: "empty" }
  | { kind: "lapsed" }
  | {
      kind: "claimed";
      result: Result<StoredAccountingDocument, TransitionCode>;
      /** Set once the transaction leasing a pending document has been built; noted on commit. */
      servedEntity?: LegalEntity | undefined;
    };

export class DrizzleAccountingDocumentWorkQueue implements IAccountingDocumentWorkQueue {
  /**
   * Turn-taking between legal entities (Books accounts): when this queue last handed out a
   * pending document of each entity, as a claim counter per provider. It counts only claims made
   * here, so other activity on a document (Xero sends, copy-email bookkeeping, re-reads) never
   * makes an entity look served. It is per process: each sender process takes turns on its own,
   * which keeps every entity served while several run, with no shared table or migration.
   */
  private readonly served = new Map<string, Map<LegalEntity, number>>();
  private claims = 0;

  constructor(
    private readonly db: Database,
    private readonly clock: AccountingClock,
  ) {}

  async claimNext(
    request: ClaimRequest,
  ): Promise<Result<StoredAccountingDocument | null, TransitionCode>> {
    for (let settled = 0; settled <= MAX_LAPSED_PER_CLAIM; settled += 1) {
      const step = await this.step(request);
      if (step.kind === "empty") return ok(null);
      if (step.kind === "claimed") {
        if (step.servedEntity) this.noteServed(request.provider, step.servedEntity);
        return step.result;
      }
    }
    return ok(null);
  }

  async holdsLease(
    documentId: string,
    leaseToken: string,
    minRemainingMs: number,
  ): Promise<boolean> {
    const until = new Date(this.clock.now().getTime() + minRemainingMs);
    const [row] = await this.db
      .select({ id: accountingDocument.id })
      .from(accountingDocument)
      .where(
        and(
          eq(accountingDocument.id, documentId),
          eq(accountingDocument.state, "sending"),
          eq(accountingDocument.leaseToken, leaseToken),
          gt(accountingDocument.leaseExpiresAt, until),
        ),
      )
      .limit(1);
    return row !== undefined;
  }

  async parkStranded(request: StrandedRequest): Promise<number> {
    if (request.targetModes.length === 0 || request.limit <= 0) return 0;
    const now = this.clock.now();
    return this.db.transaction(async (tx) => {
      const rows = await tx
        .select()
        .from(accountingDocument)
        .where(
          and(
            eq(accountingDocument.state, "pending"),
            inArray(accountingDocument.kind, ["payment", "credit_note"]),
            eq(accountingDocument.targetProvider, request.provider),
            inArray(accountingDocument.targetMode, [...request.targetModes]),
            AWAITED_INVOICE_CANCELLED,
          ),
        )
        .orderBy(asc(accountingDocument.createdAt), asc(accountingDocument.id))
        .limit(request.limit)
        .for("update", { skipLocked: true });
      let parked = 0;
      for (const row of rows) {
        const moved = await applyLockedTransition(
          tx,
          row,
          {
            action: "park",
            reason: row.kind === "credit_note" ? "credited_invoice_cancelled" : "invoice_cancelled",
          },
          now,
        );
        if (moved.ok) parked += 1;
      }
      return parked;
    });
  }

  /**
   * The legal entity whose turn it is for the provider: one this queue has not served yet, else
   * the one it served longest ago. `null` before this queue's first claim, when the order is
   * simply oldest first.
   */
  private preferredEntity(provider: string): LegalEntity | null {
    const served = this.served.get(provider);
    if (!served || served.size === 0) return null;
    let best: LegalEntity | null = null;
    let bestAt = Number.POSITIVE_INFINITY;
    for (const entity of LEGAL_ENTITIES) {
      const at = served.get(entity) ?? -1;
      if (at < bestAt) {
        best = entity;
        bestAt = at;
      }
    }
    return best;
  }

  private noteServed(provider: string, entity: LegalEntity): void {
    let served = this.served.get(provider);
    if (!served) {
      served = new Map();
      this.served.set(provider, served);
    }
    this.claims += 1;
    served.set(entity, this.claims);
  }

  /**
   * One short transaction: lock the next document nobody else holds (SKIP LOCKED) that is pending
   * or whose lease has run out, oldest first, with Stripe fees and payouts after all others. Once
   * this queue has served, the legal entity whose turn it is (see {@link served}) is tried first,
   * so a backlog in one entity never starves the other. A lapsed one becomes
   * unknown (the sender may or may not have reached the provider), a pending one is leased to the
   * caller.
   *
   * A pending document is handed only to the provider and mode it was created for (its recorded
   * target) and only while that provider is still in that mode for the product. So a Books worker
   * in `test_org` or `dry_run` can never take a document aimed at Xero live, and a flip of the
   * switch never re-aims one (`off` matches no target). Only the target modes the caller says it
   * can serve are handed out (a rehearsal-only sender never gets a test or live document). A
   * document is handed out only once what it waits for is issued (`AWAITED_ISSUED`: a payment's
   * invoices, a credit note's invoice, an invoice's or credit note's contact). The switch is read in the same statement
   * as the claim (the worker may only SELECT it, so it cannot lock it). Settling a lapsed lease only
   * demotes a stuck `sending` row to `unknown` and calls no provider, so it ignores the switch.
   */
  private step(request: ClaimRequest): Promise<Step> {
    const now = this.clock.now();
    const preferred = this.preferredEntity(request.provider);
    const claimable = or(
      and(
        eq(accountingDocument.state, "pending"),
        eq(accountingDocument.targetProvider, request.provider),
        request.targetModes.length > 0
          ? inArray(accountingDocument.targetMode, [...request.targetModes])
          : sql`false`,
        exists(
          this.db
            .select({ product: accountingSourceSetting.product })
            .from(accountingSourceSetting)
            .where(
              and(
                eq(accountingSourceSetting.product, accountingDocument.product),
                eq(
                  request.provider === "books"
                    ? accountingSourceSetting.booksMode
                    : accountingSourceSetting.xeroMode,
                  accountingDocument.targetMode,
                ),
              ),
            ),
        ),
        AWAITED_ISSUED,
      ),
      and(eq(accountingDocument.state, "sending"), lte(accountingDocument.leaseExpiresAt, now)),
    );
    return this.db.transaction(async (tx): Promise<Step> => {
      const pick = (narrow?: SQL) =>
        tx
          .select()
          .from(accountingDocument)
          .where(narrow ? and(claimable, narrow) : claimable)
          // Stripe fees and payouts go after every other document waiting, so a day of them
          // registered at once never spends the daily call budget before buyer-facing documents.
          .orderBy(
            asc(sql`${accountingDocument.kind} in ('expense', 'transfer')`),
            asc(accountingDocument.createdAt),
            asc(accountingDocument.id),
          )
          .limit(1)
          .for("update", { skipLocked: true });
      // Turns: first the entity whose turn it is (its buyer-facing documents only, so its fees
      // never jump ahead of the other entity's invoices), then everything, oldest first. The
      // narrowed pick is the same statement with two more cheap filters, so it costs no more than
      // the plain one; when that entity has nothing waiting, the plain pick runs after it.
      let [row] = preferred
        ? await pick(
            and(
              eq(accountingDocument.legalEntity, preferred),
              notInArray(accountingDocument.kind, ["expense", "transfer"]),
            ),
          )
        : [];
      if (!row) [row] = await pick();
      if (!row) return { kind: "empty" };

      if (row.state === "sending") {
        const lapsed = await applyLockedTransition(tx, row, { action: "expire_lease" }, now);
        return lapsed.ok ? { kind: "lapsed" } : { kind: "claimed", result: lapsed };
      }

      const record = rowToRecord(row, now.getTime());
      if (!record.ok)
        return { kind: "claimed", result: refuse("bad_stored_document", record.refusal.message) };
      const lease = { token: request.leaseToken, expiresAtMs: now.getTime() + request.leaseMs };
      const next = startSending(record.value, lease, now.getTime());
      if (!next.ok) return { kind: "claimed", result: next };
      const result = await persistMove(tx, row, record.value, {
        action: "start_sending",
        next: next.value,
        detail: { provider: request.provider },
        provider: request.provider,
        at: now,
      });
      return { kind: "claimed", result, servedEntity: result.ok ? row.legalEntity : undefined };
    });
  }
}
