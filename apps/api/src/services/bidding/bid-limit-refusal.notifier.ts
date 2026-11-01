import {
  type BiddingLimitRefusalNotice,
  bidderRefusalNotice,
  biddingLimitRefusalFrom,
  decidersRefusalNotice,
} from "@auction/domain";
import { formatMoneyMajor } from "@auction/email";
import type { ILegalEntityNotificationRecipientReader } from "@auction/persistence/interfaces";
import type { IOrganisationNames } from "../interfaces/organisation-names.js";
import type { NotificationDispatcher } from "../notification.dispatcher.js";

/** A bid that a channel refused, with what the bidder asked for. */
export type RefusedBid = {
  placedByUserId: string;
  /** The account the bid was for; refusals without one are not about an organisation's limits. */
  buyerLegalEntityId: string | null | undefined;
  lotId: string;
  /** What the bid committed to (the bid or its maximum), GBP major units. */
  amount: number;
  error: { code?: string | undefined; details?: Readonly<Record<string, string>> | undefined };
};

/** Sees refused bids; a refusal it does not care about is ignored. */
export interface IBidRefusalObserver {
  refused(bid: RefusedBid): Promise<void>;
}

const money = (amount: string) => formatMoneyMajor(amount, "GBP") ?? `£${amount}`;

/**
 * Tells the bidder, through the notification dispatcher (mutes and quiet hours apply), when a
 * bid for an organisation is refused at a bidding limit, with the reason in words. When the
 * organisation's own limit stopped it, owners and admins are told too, since only they can raise
 * it. Retrying the same bid does not repeat the notice. Best effort: a notice never changes the
 * refusal the bidder already sees.
 */
export class BidLimitRefusalNotifier implements IBidRefusalObserver {
  constructor(
    private readonly deps: {
      dispatcher: Pick<NotificationDispatcher, "dispatch">;
      recipients: ILegalEntityNotificationRecipientReader;
      lots: { titleOf(lotId: string): Promise<string | null> };
      people: { nameOf(userId: string): Promise<string | null> };
      organisations: IOrganisationNames;
    },
  ) {}

  async refused(bid: RefusedBid): Promise<void> {
    const legalEntityId = bid.buyerLegalEntityId;
    const refusal = biddingLimitRefusalFrom(bid.error.code, bid.error.details);
    if (!legalEntityId || !refusal) return;
    try {
      const [lotTitle, organisationName] = await Promise.all([
        this.deps.lots.titleOf(bid.lotId).catch(() => null),
        this.deps.organisations.nameOf(legalEntityId).catch(() => null),
      ]);
      const words = {
        refusal,
        amount: bid.amount.toFixed(2),
        lotTitle: lotTitle ?? "this lot",
        organisationName: organisationName ?? "the organisation",
        money,
      };
      const key = `bid-refused-limit:${bid.lotId}:${bid.placedByUserId}:${refusal.kind}:${words.amount}`;
      await this.send(
        bid.placedByUserId,
        legalEntityId,
        bid.lotId,
        bidderRefusalNotice(words),
        key,
      );

      const bidderName =
        (await this.deps.people.nameOf(bid.placedByUserId).catch(() => null)) ?? "A member";
      const deciders = decidersRefusalNotice({ ...words, bidderName });
      if (!deciders) return;
      const userIds = await this.deps.recipients.listUserIdsForAudience(legalEntityId, "admin");
      for (const userId of new Set(userIds)) {
        if (userId === bid.placedByUserId) continue;
        await this.send(userId, legalEntityId, bid.lotId, deciders, `${key}:${userId}`);
      }
    } catch (err) {
      console.error("[BidLimitRefusalNotifier] refusal notice failed", { lotId: bid.lotId, err });
    }
  }

  private async send(
    userId: string,
    legalEntityId: string,
    lotId: string,
    notice: BiddingLimitRefusalNotice,
    key: string,
  ): Promise<void> {
    await this.deps.dispatcher.dispatch(userId, {
      type: "bid_refused_limit",
      title: notice.title,
      message: notice.message,
      lotId,
      legalEntityId,
      meta: { outboxIdempotencyKey: key },
    });
  }
}
