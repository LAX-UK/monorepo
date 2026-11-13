import type { IStaffLotSellerProceedsReader } from "@auction/persistence/interfaces";
import type { IDomainEventSink } from "../domain-event-sink.js";
import { SellerProceedsError } from "./seller-proceeds-errors.js";

/** The shortest reason kept with an ATG sale settled outside LAX. */
export const SETTLED_OUTSIDE_REASON_MIN = 10;

/**
 * Records that an ATG sale was settled with its seller outside LAX, following the ATG settlement
 * runbook. LAX never pays ATG sales automatically; this keeps the record in the audit log, with
 * the seller's figure from the sale's snapshot, so the lot stops asking for it.
 */
export class MarkSettledOutsideService {
  constructor(
    private readonly deps: {
      reader: IStaffLotSellerProceedsReader;
      events: Pick<IDomainEventSink, "publish">;
    },
  ) {}

  async mark(input: { lotId: string; reason: string; actorUserId: string }): Promise<void> {
    const reason = input.reason.trim();
    if (reason.length < SETTLED_OUTSIDE_REASON_MIN) {
      throw new SellerProceedsError(
        "reason_required",
        422,
        "Say how it was settled, in at least 10 characters.",
      );
    }
    const facts = await this.deps.reader.forLot(input.lotId);
    if (!facts) throw new SellerProceedsError("lot_not_found", 404, "This lot no longer exists.");
    if (!facts.soldOnAtg || !facts.sale) {
      throw new SellerProceedsError(
        "not_sold_on_atg",
        409,
        "Only a lot sold through ATG is settled outside LAX.",
      );
    }
    await this.deps.events.publish({
      aggregateType: "lot",
      aggregateId: input.lotId,
      eventType: "lot.seller_settled_outside_lax",
      actorUserId: input.actorUserId,
      schemaVersion: 1,
      payload: {
        lotId: input.lotId,
        paymentId: facts.sale.paymentId,
        reason,
        sellerNetPence: facts.sale.terms?.sellerNetPence ?? null,
      },
    });
  }
}
