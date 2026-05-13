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

export type ConnectionState = "connecting" | "online" | "offline";

export type ConnectionStatus = {
  state: ConnectionState;
  rttMs: number | null;
  lastSampleAt: number | null;
  lastBidPropagationMs: number | null;
};

/** RTT / connection health separate from lot event streaming (SRP / ISP). */
export interface RealtimeHealthPort {
  subscribe(listener: (s: ConnectionStatus) => void): () => void;
  probe(): void;
  /** Only count `bidUpdate` propagation for this lot (room fan-out is global on the socket). */
  setBidPropagationLotId(lotId: string | null): void;
}
