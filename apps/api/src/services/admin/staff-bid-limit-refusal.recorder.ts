import { type StaffBidLimitRefusal, staffBidLimitRefusalFrom } from "@auction/domain";
import { recordMoneyPathEvent } from "../../middleware/metrics.js";
import type { IDomainEventSink } from "../domain-event-sink.js";

/** A bid staff placed on a client's behalf that the API refused. */
export type StaffPlacedBidRefusal = {
  channel: "saleroom" | "telephone";
  clerkUserId: string;
  bidderUserId: string;
  buyerLegalEntityId: string;
  saleId: string;
  lotId: string;
  /** What the bid committed to (the bid or its maximum), GBP major units. */
  amount: number;
  paddleNumber?: number | undefined;
  telephoneBookingId?: string | undefined;
  /**
   * The bid request's idempotency key (sent by the client, or derived from the bid). A transport
   * retry of the same request carries the same key, so audit readers can collapse retries.
   */
  requestKey: string;
  error: { code?: string | undefined; details?: Readonly<Record<string, string>> | undefined };
};

export interface IStaffBidLimitRefusalRecorder {
  /**
   * When a limit refused the bid: records the refusal for the audit log and returns the limit,
   * for the clerk's notice. Any other refusal returns `null` and records nothing.
   */
  record(refusal: StaffPlacedBidRefusal): Promise<StaffBidLimitRefusal | null>;
}

export const STAFF_BID_REFUSED_AT_LIMIT_EVENT = "bid.staff_bid_refused_at_limit";

/** The `auction_api_money_path_events_total` event a lost refusal audit row is counted under. */
export const STAFF_BID_REFUSAL_AUDIT_FAILED_METRIC = "staff_bid_refusal_audit_failed";

/**
 * Audits a staff-placed bid refused at a limit as one `bid.staff_bid_refused_at_limit` row on the
 * lot, with the clerk as actor. The refusal changes nothing else, so the row is the whole write.
 *
 * The audit is best-effort, by decision. The clerk's answer never waits on, or depends on, the
 * write: the bid was refused either way, and the notice telling them why matters more mid-sale.
 * There is no job queue for domain events to retry through, so a failed write is not retried. It
 * is logged and counted (`auction_api_money_path_events_total{event="staff_bid_refusal_audit_failed"}`),
 * which pages per `docs/runbooks/monitoring-alerts.md`. Rows are not deduplicated on write: each
 * carries the request's `request_key`, and readers count distinct keys.
 */
export class StaffBidLimitRefusalRecorder implements IStaffBidLimitRefusalRecorder {
  constructor(
    private readonly events: IDomainEventSink,
    private readonly countFailure: (event: string) => void = recordMoneyPathEvent,
  ) {}

  async record(input: StaffPlacedBidRefusal): Promise<StaffBidLimitRefusal | null> {
    const refusal = staffBidLimitRefusalFrom(input.error.code, input.error.details);
    if (!refusal) return null;
    try {
      await this.events.publish({
        aggregateType: "lot",
        aggregateId: input.lotId,
        eventType: STAFF_BID_REFUSED_AT_LIMIT_EVENT,
        payload: {
          channel: input.channel,
          limit_kind: refusal.kind,
          // The organisation's own limit is never recorded, only the room left on this lot.
          ...(refusal.limit != null ? { limit: refusal.limit } : {}),
          ...(refusal.available != null ? { available: refusal.available } : {}),
          amount: input.amount.toFixed(2),
          sale_id: input.saleId,
          lot_id: input.lotId,
          bidder_user_id: input.bidderUserId,
          request_key: input.requestKey,
          ...(input.paddleNumber != null ? { paddle_number: input.paddleNumber } : {}),
          ...(input.telephoneBookingId ? { telephone_booking_id: input.telephoneBookingId } : {}),
        },
        actorUserId: input.clerkUserId,
        actingLegalEntityId: input.buyerLegalEntityId,
        schemaVersion: 1,
        producer: "apps/api",
      });
    } catch (err) {
      try {
        this.countFailure(STAFF_BID_REFUSAL_AUDIT_FAILED_METRIC);
      } catch {
        /* a metrics fault never changes the clerk's answer */
      }
      console.error("[StaffBidLimitRefusalRecorder] refusal audit failed", {
        lotId: input.lotId,
        channel: input.channel,
        err,
      });
    }
    return refusal;
  }
}
