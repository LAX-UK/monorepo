import type { Database } from "@auction/db";
import { bid, domainEvent, lotFulfilment, payment } from "@auction/db/schema";
import { and, eq, inArray, sql } from "drizzle-orm";
import type {
  ILotTransitionGuardReader,
  LotTransitionGuardCounts,
} from "./interfaces/lot-transition-guard.reader.js";

const BLOCKING_PAYMENT_STATUSES = [
  "pending",
  "authorized",
  "captured",
  "requires_manual_review",
] as const;

export class DrizzleLotTransitionGuardReader implements ILotTransitionGuardReader {
  constructor(private readonly db: Database) {}

  async countForLot(lotId: string): Promise<LotTransitionGuardCounts> {
    const [paymentRow] = await this.db
      .select({ n: sql<number>`count(*)::int` })
      .from(payment)
      .where(
        and(eq(payment.lotId, lotId), inArray(payment.status, [...BLOCKING_PAYMENT_STATUSES])),
      );

    const [bidRow] = await this.db
      .select({ n: sql<number>`count(*)::int` })
      .from(bid)
      .where(eq(bid.lotId, lotId));

    const [fulfilmentRow] = await this.db
      .select({ status: lotFulfilment.status })
      .from(lotFulfilment)
      .where(eq(lotFulfilment.lotId, lotId))
      .limit(1);

    const openDisputeCount = await this.countOpenDisputesForLot(lotId);

    const fulfilmentStatus = fulfilmentRow?.status;
    const fulfilmentInProgress =
      fulfilmentStatus != null &&
      fulfilmentStatus !== "cancelled" &&
      fulfilmentStatus !== "delivered";

    return {
      paymentCount: paymentRow?.n ?? 0,
      openDisputeCount,
      fulfilmentInProgress,
      activeBidCount: bidRow?.n ?? 0,
    };
  }

  private async countOpenDisputesForLot(lotId: string): Promise<number> {
    const payments = await this.db
      .select({ id: payment.id })
      .from(payment)
      .where(eq(payment.lotId, lotId));
    if (payments.length === 0) return 0;

    const paymentIds = payments.map((p) => p.id);
    const opened = await this.db
      .select({ aggregateId: domainEvent.aggregateId })
      .from(domainEvent)
      .where(
        and(
          eq(domainEvent.aggregateType, "payment"),
          eq(domainEvent.eventType, "payment.dispute_opened"),
          inArray(domainEvent.aggregateId, paymentIds),
        ),
      );

    if (opened.length === 0) return 0;

    const openedIds = opened.map((r) => r.aggregateId);
    const closed = await this.db
      .select({ aggregateId: domainEvent.aggregateId })
      .from(domainEvent)
      .where(
        and(
          eq(domainEvent.aggregateType, "payment"),
          eq(domainEvent.eventType, "payment.dispute_closed"),
          inArray(domainEvent.aggregateId, openedIds),
        ),
      );
    const closedSet = new Set(closed.map((r) => r.aggregateId));
    return openedIds.filter((id) => !closedSet.has(id)).length;
  }

  async assertReturnToInventoryAllowed(lotId: string): Promise<string | null> {
    const counts = await this.countForLot(lotId);
    if (counts.paymentCount > 0) {
      return "This lot has payment records and cannot be returned to inventory";
    }
    if (counts.openDisputeCount > 0) {
      return "This lot has an open payment dispute and cannot be returned to inventory";
    }
    if (counts.fulfilmentInProgress) {
      return "This lot has fulfilment in progress and cannot be returned to inventory";
    }
    return null;
  }
}
