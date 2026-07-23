import type { Database } from "@auction/db";
import type { Bid } from "@auction/types";
import { parseMoneyToMinorUnits } from "@auction/validators";
import type { IDomainEventSink } from "../ports.js";

export type PublishBidMilestoneDomainEventsInput = {
  lotId: string;
  winningBid: Bid;
  prevWinnerId: string | null;
  prevWinningBid: Bid | null;
  isFirstBidForUserOnLot: boolean;
};

export async function publishBidMilestoneDomainEvents(
  domainEventSink: IDomainEventSink | null | undefined,
  tx: Database,
  input: PublishBidMilestoneDomainEventsInput,
): Promise<void> {
  if (!domainEventSink) return;

  const sink = domainEventSink.withTx(tx);
  const newWinnerId = input.winningBid.placedByUserId ?? input.winningBid.bidderId ?? null;
  if (!newWinnerId) return;

  if (input.isFirstBidForUserOnLot) {
    await sink.publish({
      aggregateType: "bid",
      aggregateId: input.winningBid.id,
      eventType: "bid.first_for_user",
      payload: {
        bidId: input.winningBid.id,
        lotId: input.lotId,
        userId: newWinnerId,
        amountCents: Number(parseMoneyToMinorUnits(input.winningBid.amount)),
        placedAt: input.winningBid.createdAt.toISOString(),
      },
      actorUserId: newWinnerId,
    });
  }

  const displacedBidId = input.prevWinningBid?.id ?? null;
  if (input.prevWinnerId && displacedBidId && input.prevWinnerId !== newWinnerId) {
    await sink.publish({
      aggregateType: "bid",
      aggregateId: displacedBidId,
      eventType: "bid.outbid",
      payload: {
        previousBidId: displacedBidId,
        displacedBidId,
        lotId: input.lotId,
        userId: input.prevWinnerId,
        newHighAmountCents: Number(parseMoneyToMinorUnits(input.winningBid.amount)),
      },
      actorUserId: newWinnerId,
    });
  }
}
