import { type Result, ok, refuse, startSending } from "@auction/accounting-domain";
import type { Database } from "@auction/db";
import { accountingDocument } from "@auction/db/schema";
import { and, asc, eq, lte, or } from "drizzle-orm";
import type {
  AccountingClock,
  ClaimRequest,
  IAccountingDocumentWorkQueue,
  StoredAccountingDocument,
  TransitionCode,
} from "../../interfaces/accounting.js";
import { applyLockedTransition, persistMove } from "../../lib/accounting-document-move.js";
import { rowToRecord } from "../../lib/accounting-document-row.js";

/** How many lapsed leases one call settles before it gives up looking for pending work. */
const MAX_LAPSED_PER_CLAIM = 100;

type Step =
  | { kind: "empty" }
  | { kind: "lapsed" }
  | { kind: "claimed"; result: Result<StoredAccountingDocument, TransitionCode> };

export class DrizzleAccountingDocumentWorkQueue implements IAccountingDocumentWorkQueue {
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
      if (step.kind === "claimed") return step.result;
    }
    return ok(null);
  }

  /**
   * One short transaction: lock the oldest document nobody else holds (SKIP LOCKED) that is pending
   * or whose lease has run out. A lapsed one becomes unknown (the sender may or may not have
   * reached the provider), a pending one is leased to the caller.
   */
  private step(request: ClaimRequest): Promise<Step> {
    const now = this.clock.now();
    return this.db.transaction(async (tx): Promise<Step> => {
      const [row] = await tx
        .select()
        .from(accountingDocument)
        .where(
          or(
            eq(accountingDocument.state, "pending"),
            and(
              eq(accountingDocument.state, "sending"),
              lte(accountingDocument.leaseExpiresAt, now),
            ),
          ),
        )
        .orderBy(asc(accountingDocument.createdAt), asc(accountingDocument.id))
        .limit(1)
        .for("update", { skipLocked: true });
      if (!row) return { kind: "empty" };

      if (row.state === "sending") {
        const lapsed = await applyLockedTransition(tx, row, { action: "expire_lease" }, now);
        return lapsed.ok ? { kind: "lapsed" } : { kind: "claimed", result: lapsed };
      }

      const record = rowToRecord(row);
      if (!record.ok)
        return { kind: "claimed", result: refuse("bad_stored_document", record.refusal.message) };
      const lease = { token: request.leaseToken, expiresAtMs: now.getTime() + request.leaseMs };
      const next = startSending(record.value, lease, now.getTime());
      if (!next.ok) return { kind: "claimed", result: next };
      return {
        kind: "claimed",
        result: await persistMove(tx, row, record.value, {
          action: "start_sending",
          next: next.value,
          detail: { provider: request.provider },
          provider: request.provider,
          at: now,
        }),
      };
    });
  }
}
