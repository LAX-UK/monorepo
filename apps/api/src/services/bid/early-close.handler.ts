import type { Database } from "@auction/db";
import type { ILotRepository } from "@auction/persistence";
import type { Bid, Lot } from "@auction/types";
import type { ILotStrategy } from "../interfaces/auction-strategy.js";
import type { ILotLifecycleRecorder } from "../interfaces/lot-lifecycle-recorder.js";

export type EarlyCloseOutcome = {
  endedEarly: true;
  winnerUserId: string;
  winnerLegalEntityId: string;
  hammerPrice: string;
};

export class EarlyCloseHandler {
  constructor(private readonly lotLifecycleRecording: ILotLifecycleRecorder | null) {}

  async tryEarlyClose(params: {
    strategy: ILotStrategy;
    lots: ILotRepository;
    lotRow: Lot;
    lastBid: Bid;
    buyerLegalEntityId: string;
    placedByUserId: string;
    tx: Database;
  }): Promise<EarlyCloseOutcome | null> {
    const result = params.strategy.resolveEarlyClose?.(params.lotRow, params.lastBid, {
      buyerLegalEntityId: params.buyerLegalEntityId,
    });
    if (!result?.endedEarly) return null;

    await params.lots.setWinner(params.lotRow.id, result.winnerUserId, result.winnerLegalEntityId);
    await params.lots.updateStatus(params.lotRow.id, "ended");

    if (this.lotLifecycleRecording) {
      await this.lotLifecycleRecording.recordEnded(params.tx, {
        lot: {
          id: params.lotRow.id,
          status: "ended",
          saleId: params.lotRow.saleId,
          sellerLegalEntityId: params.lotRow.sellerLegalEntityId,
        },
        payload: {
          outcome: "sold",
          winnerId: result.winnerUserId,
          saleId: params.lotRow.saleId,
          trigger: "early_close",
          hammerPrice: result.hammerPrice,
        },
        actorUserId: params.placedByUserId,
      });
    }

    return {
      endedEarly: true,
      winnerUserId: result.winnerUserId,
      winnerLegalEntityId: result.winnerLegalEntityId,
      hammerPrice: result.hammerPrice,
    };
  }
}
