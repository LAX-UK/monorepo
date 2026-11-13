import { LONDON_TIME_ZONE, dayKey } from "@auction/datetime";
import type {
  ISignedAgreementWriter,
  IStaffLotSellerProceedsReader,
} from "@auction/persistence/interfaces";
import type { IDomainEventSink } from "../domain-event-sink.js";
import { SellerProceedsError } from "./seller-proceeds-errors.js";

/** The shortest reason kept with an ATG sale settled outside LAX. */
export const SETTLED_OUTSIDE_REASON_MIN = 10;

/** The writes one mark makes, in one transaction, and the read it decides from. */
export type SettledOutsideUnitOfWork = <T>(
  work: (ports: {
    facts: IStaffLotSellerProceedsReader;
    locks: Pick<ISignedAgreementWriter, "lockSale">;
    events: Pick<IDomainEventSink, "publish">;
  }) => Promise<T>,
) => Promise<T>;

/**
 * Records that an ATG sale was settled with its seller outside LAX, following the ATG settlement
 * runbook. LAX never pays ATG sales automatically; this keeps the record in the audit log, with
 * the seller's figure from the sale's snapshot, so the lot stops asking for it. A sale is marked
 * once: the payment row is locked and the mark read again under it, so a second click or a second
 * person is refused (409) and told when it was marked.
 */
export class MarkSettledOutsideService {
  constructor(
    private readonly deps: {
      reader: IStaffLotSellerProceedsReader;
      unitOfWork: SettledOutsideUnitOfWork;
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
    if (facts.settledOutsideAt) throw alreadyMarked(facts.settledOutsideAt);
    const paymentId = facts.sale.paymentId;
    await this.deps.unitOfWork(async ({ facts: inTx, locks, events }) => {
      await locks.lockSale({ paymentId, sellerTermsId: null });
      const now = await inTx.forLot(input.lotId);
      if (now?.settledOutsideAt) throw alreadyMarked(now.settledOutsideAt);
      await events.publish({
        aggregateType: "lot",
        aggregateId: input.lotId,
        eventType: "lot.seller_settled_outside_lax",
        actorUserId: input.actorUserId,
        schemaVersion: 1,
        payload: {
          lotId: input.lotId,
          paymentId,
          reason,
          sellerNetPence: (now ?? facts).sale?.terms?.sellerNetPence ?? null,
        },
      });
    });
  }
}

function alreadyMarked(at: Date): SellerProceedsError {
  const [y, m, d] = dayKey(at, LONDON_TIME_ZONE).split("-");
  return new SellerProceedsError(
    "already_settled_outside",
    409,
    `This sale was already marked as settled outside LAX on ${d}/${m}/${y}.`,
  );
}
