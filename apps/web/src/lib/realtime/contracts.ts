import type { BidUpdateEvent, LotEndedEvent } from "@auction/types";

export type BidUpdateHandler = (event: BidUpdateEvent) => void;

export type LotRealtimeCallbacks = {
  onBidUpdate?: BidUpdateHandler;
  onLotExtended?: (payload: unknown) => void;
  onLotEnded?: (payload: LotEndedEvent) => void;
  onLotEvent?: (payload: unknown) => void;
};

/** Narrow port for lot rooms — no raw Socket exposure (ISP). */
export interface LotRealtimePort {
  subscribeToLot(lotId: string, callbacks: LotRealtimeCallbacks): () => void;
  leaveLot(lotId: string): void;
}
