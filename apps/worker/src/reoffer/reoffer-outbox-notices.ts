import type { Database } from "@auction/db";
import type { INotificationOutboxRepository } from "@auction/persistence/interfaces";
import type { ICollectionNoticeReader } from "../interfaces/collection-notice.reader.js";
import type { IReofferNotices, ReofferNoticeSubject } from "./reoffer-clock-ports.js";
import {
  type ReofferNoticeCopy,
  offerEndedBidderCopy,
  offerEndedSellerCopy,
  offerReminderCopy,
  sellerReminderCopy,
} from "./reoffer-notice-copy.js";

type NoticeKind =
  | "reoffer_seller_reminder"
  | "reoffer_offer_reminder"
  | "reoffer_offer_closed"
  | "reoffer_seller_outcome";

/** One notice per person per kind per offer: the key is what makes a repeated step raise one. */
function noticeKey(kind: NoticeKind, reofferId: string, userId: string): string {
  return `${kind}:${reofferId}:${userId}`;
}

/**
 * Raises the clock's notices through the notification outbox, in the step's own transaction: a
 * step that rolls back raises nothing, and one that runs twice raises one. The outbox delivers
 * them as in-app notices.
 */
export class OutboxReofferNotices implements IReofferNotices {
  constructor(
    private readonly outbox: Pick<INotificationOutboxRepository, "stage">,
    private readonly people: Pick<ICollectionNoticeReader, "accountRecipients">,
  ) {}

  sellerReminder(tx: Database, subject: ReofferNoticeSubject, sellerLegalEntityId: string) {
    return this.toAccount(
      tx,
      "reoffer_seller_reminder",
      subject,
      sellerLegalEntityId,
      sellerReminderCopy(this.copyInput(subject)),
    );
  }

  offerReminder(tx: Database, subject: ReofferNoticeSubject) {
    return this.toBidder(
      tx,
      "reoffer_offer_reminder",
      subject,
      offerReminderCopy(this.copyInput(subject)),
    );
  }

  async offerEnded(
    tx: Database,
    subject: ReofferNoticeSubject,
    seller: { legalEntityId: string; agreed: boolean } | null,
  ): Promise<number> {
    const input = this.copyInput(subject);
    let staged = await this.toBidder(
      tx,
      "reoffer_offer_closed",
      subject,
      offerEndedBidderCopy(input),
    );
    // The seller is told when they agreed to this offer; LAX-owned stock has nobody to tell.
    if (seller?.agreed) {
      staged += await this.toAccount(
        tx,
        "reoffer_seller_outcome",
        subject,
        seller.legalEntityId,
        offerEndedSellerCopy(input),
      );
    }
    return staged;
  }

  private copyInput(subject: ReofferNoticeSubject) {
    return {
      lot: subject.lot.title,
      at: subject.at,
      now: subject.now,
      amountPence: subject.offer.amountPence,
    };
  }

  private async toBidder(
    tx: Database,
    kind: NoticeKind,
    subject: ReofferNoticeSubject,
    copy: ReofferNoticeCopy,
  ): Promise<number> {
    const { offer } = subject;
    return this.stage(tx, kind, subject, offer.offeredUserId, offer.offeredLegalEntityId, copy);
  }

  private async toAccount(
    tx: Database,
    kind: NoticeKind,
    subject: ReofferNoticeSubject,
    legalEntityId: string,
    copy: ReofferNoticeCopy,
  ): Promise<number> {
    const people = await this.people.accountRecipients(legalEntityId);
    let staged = 0;
    for (const person of people) {
      staged += await this.stage(tx, kind, subject, person.userId, legalEntityId, copy);
    }
    return staged;
  }

  private async stage(
    tx: Database,
    kind: NoticeKind,
    subject: ReofferNoticeSubject,
    userId: string,
    legalEntityId: string,
    copy: ReofferNoticeCopy,
  ): Promise<number> {
    const created = await this.outbox.stage(
      {
        userId,
        idempotencyKey: noticeKey(kind, subject.offer.id, userId),
        payload: {
          type: kind,
          title: copy.title,
          message: copy.message,
          lotId: subject.lot.id,
          legalEntityId,
        },
      },
      tx,
    );
    return created ? 1 : 0;
  }
}
