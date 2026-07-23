import { biddingRouteFromServiceResult } from "../interfaces/bidding-routes/bidding-route-http.js";
import type { IBiddingSaleroomDisplayHttpApplicationService } from "../interfaces/bidding-routes/bidding-saleroom-display-http.js";
import type { IDisplayPairingService } from "../interfaces/display-pairing-service.js";
import type { IDisplaySnapshotReader } from "../interfaces/display-snapshot-reader.js";

export class BiddingSaleroomDisplayHttpApplicationService
  implements IBiddingSaleroomDisplayHttpApplicationService
{
  constructor(
    private readonly displayPairingService: IDisplayPairingService,
    private readonly displaySnapshotReader: IDisplaySnapshotReader,
  ) {}

  async startPairing() {
    const data = await this.displayPairingService.startPairing();
    return { kind: "ok" as const, data };
  }

  async pollPairing(deviceCode: string) {
    const data = await this.displayPairingService.pollPairing(deviceCode);
    return { kind: "ok" as const, data };
  }

  async verifyDisplayTokenForSale(input: { displayToken: string; saleId: string }) {
    const verified = await this.displayPairingService.verifyDisplayTokenForSale(
      input.displayToken,
      input.saleId,
    );
    if (verified.isErr()) {
      return { kind: "err" as const, error: verified.error };
    }
    return { kind: "ok" as const, data: { ok: true as const } };
  }

  async getSnapshot(input: { displayToken: string; saleId: string }) {
    const verified = await this.displayPairingService.verifyDisplayTokenForSale(
      input.displayToken,
      input.saleId,
    );
    if (verified.isErr()) {
      return { kind: "err" as const, error: verified.error };
    }
    const snapshot = await this.displaySnapshotReader.getSnapshot(input.saleId);
    if (!snapshot) {
      return { kind: "not_found" as const };
    }
    return { kind: "ok" as const, data: snapshot };
  }

  async heartbeat(displayToken: string) {
    const result = await this.displayPairingService.heartbeat(displayToken);
    return biddingRouteFromServiceResult(result);
  }
}
