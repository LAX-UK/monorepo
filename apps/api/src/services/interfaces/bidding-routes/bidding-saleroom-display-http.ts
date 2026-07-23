import type { SaleroomDisplayPairPollResult, SaleroomDisplayPairingStart } from "@auction/types";
import type { SaleroomDisplaySnapshot } from "@auction/types";
import type { BiddingRouteOutcome } from "./bidding-route-http.js";

export interface IBiddingSaleroomDisplayHttpApplicationService {
  startPairing(): Promise<BiddingRouteOutcome<SaleroomDisplayPairingStart>>;

  pollPairing(deviceCode: string): Promise<BiddingRouteOutcome<SaleroomDisplayPairPollResult>>;

  verifyDisplayTokenForSale(input: {
    displayToken: string;
    saleId: string;
  }): Promise<BiddingRouteOutcome<{ ok: true }>>;

  getSnapshot(input: {
    displayToken: string;
    saleId: string;
  }): Promise<BiddingRouteOutcome<SaleroomDisplaySnapshot> | { kind: "not_found" }>;

  heartbeat(displayToken: string): Promise<BiddingRouteOutcome<{ ok: true }>>;
}
