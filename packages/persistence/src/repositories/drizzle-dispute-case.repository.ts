import type { Database } from "@auction/db";
import {
  disputeAllocation,
  disputeCase,
  disputeCaseCandidate,
  domainEvent,
  payment,
} from "@auction/db/schema";
import {
  DISPUTE_STATUSES_WITHOUT_LOSS,
  type DisputeAllocationSource,
  type DisputeAllocationState,
  type DisputeCandidate,
  type DisputeLineClawback,
} from "@auction/domain";
import { and, asc, eq, inArray, notInArray, sql } from "drizzle-orm";
import type {
  DisputeAllocationRecord,
  DisputeCaseRecord,
  DisputeStripeSnapshot,
  IDisputeAllocationQueueReader,
  IDisputeCaseRepository,
  IDisputePaymentReader,
  LegacyDisputeLine,
  NewDisputeAllocation,
  NewDisputeCase,
} from "../interfaces/dispute-case.repository.js";

type CaseRow = typeof disputeCase.$inferSelect;
type AllocationRow = typeof disputeAllocation.$inferSelect;

function mapCase(row: CaseRow): DisputeCaseRecord {
  return {
    id: row.id,
    stripeDisputeId: row.stripeDisputeId,
    stripeChargeId: row.stripeChargeId,
    stripePaymentIntentId: row.stripePaymentIntentId,
    amountPence: row.amountPence,
    currency: row.currency,
    reason: row.reason,
    networkReasonCode: row.networkReasonCode,
    cardBrand: row.cardBrand,
    cardLast4: row.cardLast4,
    status: row.status,
    dueBy: row.dueBy,
    evidenceSubmitted: row.evidenceSubmitted,
    chargeRefundable: row.chargeRefundable,
    allocationState: row.allocationState as DisputeAllocationState,
    fundsWithdrawnAt: row.fundsWithdrawnAt,
    fundsReinstatedAt: row.fundsReinstatedAt,
    stripeCreatedAt: row.stripeCreatedAt,
    lastEventAt: row.lastEventAt,
    closedAt: row.closedAt,
    version: row.version,
  };
}

function mapAllocation(row: AllocationRow): DisputeAllocationRecord {
  return {
    id: row.id,
    caseId: row.caseId,
    paymentId: row.paymentId,
    sellerLegalEntityId: row.sellerLegalEntityId,
    amountPence: row.amountPence,
    sellerSharePence: row.sellerSharePence,
    clawback: row.clawback as DisputeLineClawback,
    source: row.source as DisputeAllocationSource,
  };
}

function snapshotColumns(snapshot: DisputeStripeSnapshot) {
  return {
    status: snapshot.status,
    amountPence: snapshot.amountPence,
    currency: snapshot.currency,
    reason: snapshot.reason,
    networkReasonCode: snapshot.networkReasonCode,
    cardBrand: snapshot.cardBrand,
    cardLast4: snapshot.cardLast4,
    dueBy: snapshot.dueBy,
    evidenceSubmitted: snapshot.evidenceSubmitted,
    chargeRefundable: snapshot.chargeRefundable,
    lastEventAt: snapshot.eventAt,
    closedAt: snapshot.closedAt,
  };
}

export class DrizzleDisputeCaseRepository
  implements IDisputeCaseRepository, IDisputeAllocationQueueReader
{
  constructor(private readonly db: Database) {}

  async insertOrLockInTransaction(
    tx: Database,
    input: NewDisputeCase,
  ): Promise<{ record: DisputeCaseRecord; created: boolean }> {
    const [inserted] = await tx
      .insert(disputeCase)
      .values({
        stripeDisputeId: input.stripeDisputeId,
        stripeChargeId: input.stripeChargeId,
        stripePaymentIntentId: input.stripePaymentIntentId,
        stripeCreatedAt: input.stripeCreatedAt,
        allocationState: input.allocationState,
        fundsWithdrawnAt: input.fundsWithdrawnAt,
        fundsReinstatedAt: input.fundsReinstatedAt,
        ...snapshotColumns(input.snapshot),
      })
      .onConflictDoNothing({ target: disputeCase.stripeDisputeId })
      .returning();
    if (inserted) {
      const paymentIds = [...new Set(input.candidatePaymentIds)];
      if (paymentIds.length > 0) {
        await tx
          .insert(disputeCaseCandidate)
          .values(paymentIds.map((paymentId) => ({ caseId: inserted.id, paymentId })));
      }
      return { record: mapCase(inserted), created: true };
    }
    // Another delivery recorded it first; its transaction has committed by now.
    const existing = await this.lockByStripeIdInTransaction(tx, input.stripeDisputeId);
    if (!existing) throw new Error(`dispute_case vanished: ${input.stripeDisputeId}`);
    return { record: existing, created: false };
  }

  async lockByStripeIdInTransaction(
    tx: Database,
    stripeDisputeId: string,
  ): Promise<DisputeCaseRecord | null> {
    const [row] = await tx
      .select()
      .from(disputeCase)
      .where(eq(disputeCase.stripeDisputeId, stripeDisputeId))
      .for("update");
    return row ? mapCase(row) : null;
  }

  async lockByIdInTransaction(tx: Database, caseId: string): Promise<DisputeCaseRecord | null> {
    const [row] = await tx
      .select()
      .from(disputeCase)
      .where(eq(disputeCase.id, caseId))
      .for("update");
    return row ? mapCase(row) : null;
  }

  async applySnapshotInTransaction(
    tx: Database,
    caseId: string,
    snapshot: DisputeStripeSnapshot,
  ): Promise<void> {
    await tx
      .update(disputeCase)
      .set({ ...snapshotColumns(snapshot), updatedAt: new Date() })
      .where(eq(disputeCase.id, caseId));
  }

  async recordFundsInTransaction(
    tx: Database,
    caseId: string,
    funds: { fundsWithdrawnAt: Date | null; fundsReinstatedAt: Date | null },
  ): Promise<void> {
    await tx
      .update(disputeCase)
      .set({ ...funds, updatedAt: new Date() })
      .where(eq(disputeCase.id, caseId));
  }

  async markAllocatedInTransaction(
    tx: Database,
    caseId: string,
    expectedVersion: number,
  ): Promise<boolean> {
    const updated = await tx
      .update(disputeCase)
      .set({
        allocationState: "allocated",
        version: sql`${disputeCase.version} + 1`,
        updatedAt: new Date(),
      })
      .where(and(eq(disputeCase.id, caseId), eq(disputeCase.version, expectedVersion)))
      .returning({ id: disputeCase.id });
    return updated.length > 0;
  }

  async listCandidatePaymentIdsInTransaction(tx: Database, caseId: string): Promise<string[]> {
    const rows = await tx
      .select({ paymentId: disputeCaseCandidate.paymentId })
      .from(disputeCaseCandidate)
      .where(eq(disputeCaseCandidate.caseId, caseId))
      .orderBy(asc(disputeCaseCandidate.paymentId));
    return rows.map((r) => r.paymentId);
  }

  async listAllocationsInTransaction(
    tx: Database,
    caseId: string,
  ): Promise<DisputeAllocationRecord[]> {
    const rows = await tx
      .select()
      .from(disputeAllocation)
      .where(eq(disputeAllocation.caseId, caseId))
      .orderBy(asc(disputeAllocation.createdAt), asc(disputeAllocation.paymentId));
    return rows.map(mapAllocation);
  }

  async insertAllocationsInTransaction(
    tx: Database,
    caseId: string,
    lines: readonly NewDisputeAllocation[],
  ): Promise<DisputeAllocationRecord[]> {
    if (lines.length === 0) return [];
    const rows = await tx
      .insert(disputeAllocation)
      .values(
        lines.map((line) => ({
          caseId,
          paymentId: line.paymentId,
          sellerLegalEntityId: line.sellerLegalEntityId,
          amountPence: line.amountPence,
          sellerSharePence: line.sellerSharePence,
          clawback: line.clawback,
          source: line.source,
          allocatedByUserId: line.allocatedByUserId,
        })),
      )
      .returning();
    return rows.map(mapAllocation);
  }

  async setClawbackInTransaction(
    tx: Database,
    allocationId: string,
    clawback: DisputeLineClawback,
  ): Promise<void> {
    await tx
      .update(disputeAllocation)
      .set({ clawback, updatedAt: new Date() })
      .where(eq(disputeAllocation.id, allocationId));
  }

  async countAwaitingAllocation(): Promise<number> {
    const [row] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(disputeCase)
      .where(
        and(
          eq(disputeCase.allocationState, "needs_allocation"),
          notInArray(disputeCase.status, [...DISPUTE_STATUSES_WITHOUT_LOSS]),
        ),
      );
    return row?.count ?? 0;
  }
}

const CANDIDATE_COLUMNS = {
  paymentId: payment.id,
  sellerLegalEntityId: payment.sellerLegalEntityId,
  amountPence: sql<number>`round(${payment.amount} * 100)::int`,
  platformFeePence: sql<number>`round(${payment.platformFee} * 100)::int`,
};

const LEGACY_EVENT_TYPES = [
  "payment.dispute_opened",
  "payment.dispute_funds_withdrawn",
  "payment.dispute_closed",
];

function payloadNumber(payload: Record<string, unknown>, key: string): number | null {
  const v = payload[key];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function payloadString(payload: Record<string, unknown>, key: string): string | null {
  const v = payload[key];
  return typeof v === "string" && v.length > 0 ? v : null;
}

export class DrizzleDisputePaymentReader implements IDisputePaymentReader {
  async listByChargeInTransaction(
    tx: Database,
    refs: { chargeId: string; paymentIntentId: string | null },
  ): Promise<DisputeCandidate[]> {
    const byCharge = await tx
      .select(CANDIDATE_COLUMNS)
      .from(payment)
      .where(eq(payment.stripeChargeId, refs.chargeId))
      .orderBy(asc(payment.createdAt), asc(payment.id));
    if (byCharge.length > 0 || !refs.paymentIntentId) return byCharge;
    return tx
      .select(CANDIDATE_COLUMNS)
      .from(payment)
      .where(eq(payment.stripePaymentIntentId, refs.paymentIntentId))
      .orderBy(asc(payment.createdAt), asc(payment.id));
  }

  async findByIdsInTransaction(
    tx: Database,
    paymentIds: readonly string[],
  ): Promise<DisputeCandidate[]> {
    const ids = [...new Set(paymentIds)];
    if (ids.length === 0) return [];
    return tx.select(CANDIDATE_COLUMNS).from(payment).where(inArray(payment.id, ids));
  }

  async legacyLinesInTransaction(
    tx: Database,
    stripeDisputeId: string,
  ): Promise<LegacyDisputeLine[]> {
    const events = await tx
      .select({
        paymentId: domainEvent.aggregateId,
        eventType: domainEvent.eventType,
        payload: domainEvent.payload,
      })
      .from(domainEvent)
      .where(
        and(
          eq(domainEvent.aggregateType, "payment"),
          inArray(domainEvent.eventType, LEGACY_EVENT_TYPES),
          sql`${domainEvent.payload}->>'stripeDisputeId' = ${stripeDisputeId}`,
        ),
      )
      .orderBy(asc(domainEvent.id));

    const lines = new Map<string, LegacyDisputeLine & { wonClosed: boolean }>();
    for (const event of events) {
      const payload = (event.payload ?? {}) as Record<string, unknown>;
      const line = lines.get(event.paymentId) ?? {
        paymentId: event.paymentId,
        sellerLegalEntityId: payloadString(payload, "sellerLegalEntityId") ?? "",
        amountPence: payloadNumber(payload, "amountCents") ?? 0,
        sellerSharePence: payloadNumber(payload, "amountCents") ?? 0,
        clawback: "none" as DisputeLineClawback,
        wonClosed: false,
      };
      if (event.eventType === "payment.dispute_funds_withdrawn") line.clawback = "withdrawn";
      if (event.eventType === "payment.dispute_closed" && payload.outcome === "won") {
        line.wonClosed = true;
      }
      lines.set(event.paymentId, line);
    }
    return [...lines.values()]
      .filter((l) => l.sellerLegalEntityId !== "" && l.amountPence > 0)
      .map(({ wonClosed, ...line }) => ({
        ...line,
        clawback: wonClosed && line.clawback === "withdrawn" ? "reversed" : line.clawback,
      }));
  }
}
