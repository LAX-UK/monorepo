import type { Database } from "@auction/db";
import type { LotReofferView, ReofferLockedLot } from "@auction/persistence/interfaces";

/** The lot events the clock records, each with the offer it is about. */
export type ReofferClockEventType = "lot.seller_consent_lapsed" | "lot.reoffer_expired";

/** Records a step the clock took in the same transaction as the step. */
export interface IReofferClockEvents {
  record(
    tx: Database,
    lot: Pick<ReofferLockedLot, "id" | "saleId" | "sellerLegalEntityId">,
    eventType: ReofferClockEventType,
    offer: LotReofferView,
  ): Promise<void>;
}

/** What a notice is about. Ids and amounts only; the adapter turns them into words. */
export type ReofferNoticeSubject = {
  offer: LotReofferView;
  lot: Pick<ReofferLockedLot, "id" | "title" | "lotNumber">;
  /** The seller's answer is due, or the offer ends, at this time. */
  at: Date;
  now: Date;
};

/**
 * Notices the clock raises. Each is staged in the caller's transaction under a key that names the
 * offer and the person, so a step that runs twice raises one notice. Nothing here sends mail or
 * moves money: staging only queues an in-app notice.
 */
export interface IReofferNotices {
  /** The seller's one reminder: the answer is due at `at`. */
  sellerReminder(
    tx: Database,
    subject: ReofferNoticeSubject,
    sellerLegalEntityId: string,
  ): Promise<number>;
  /** The bidder's reminder: the offer ends at `at`. */
  offerReminder(tx: Database, subject: ReofferNoticeSubject): Promise<number>;
  /** The offer ended unanswered: the bidder is told, and the seller when they agreed to it. */
  offerEnded(
    tx: Database,
    subject: ReofferNoticeSubject,
    seller: { legalEntityId: string; agreed: boolean } | null,
  ): Promise<number>;
}
