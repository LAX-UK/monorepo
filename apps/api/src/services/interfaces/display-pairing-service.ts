import type {
  SaleroomDisplayDeviceRow,
  SaleroomDisplayPairPollResult,
  SaleroomDisplayPairingStart,
} from "@auction/types";
import type { Result } from "neverthrow";

export type DisplayServiceError = { message: string; status: number; code?: string };

export interface IDisplayPairingService {
  startPairing(): Promise<SaleroomDisplayPairingStart>;
  pollPairing(deviceCode: string): Promise<SaleroomDisplayPairPollResult>;
  approvePairing(input: {
    userCode: string;
    saleId: string;
    actorUserId: string;
  }): Promise<Result<{ pairingId: string }, DisplayServiceError>>;
  revokePairing(input: {
    pairingId: string;
    saleId: string;
    actorUserId: string;
  }): Promise<Result<void, DisplayServiceError>>;
  heartbeat(displayToken: string): Promise<Result<{ ok: true }, DisplayServiceError>>;
  listDevices(saleId: string): Promise<SaleroomDisplayDeviceRow[]>;
  verifyDisplayTokenForSale(
    displayToken: string,
    saleId: string,
  ): Promise<Result<{ pairingId: string }, DisplayServiceError>>;
  cleanupStalePairings(): Promise<{ expiredPending: number; purged: number }>;
}
