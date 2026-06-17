import type { saleroomDisplayPairing } from "@auction/db/schema";

export type DisplayPairingRow = typeof saleroomDisplayPairing.$inferSelect;

export type InsertDisplayPairingInput = {
  deviceCodeHash: string;
  userCode: string;
  expiresAt: Date;
};

export type ApproveDisplayPairingInput = {
  pairingId: string;
  saleId: string;
  displayTokenHash: string;
  approvedByUserId: string;
  pairedAt: Date;
};

export interface IDisplayPairingRepository {
  insertPending(input: InsertDisplayPairingInput): Promise<DisplayPairingRow>;
  findByDeviceCodeHash(deviceCodeHash: string): Promise<DisplayPairingRow | null>;
  findPendingByUserCode(userCode: string): Promise<DisplayPairingRow | null>;
  findByDisplayTokenHash(tokenHash: string): Promise<DisplayPairingRow | null>;
  approve(input: ApproveDisplayPairingInput): Promise<DisplayPairingRow | null>;
  revoke(pairingId: string): Promise<DisplayPairingRow | null>;
  markExpired(pairingId: string): Promise<void>;
  touchLastSeen(pairingId: string, at: Date): Promise<void>;
  listForSale(saleId: string): Promise<DisplayPairingRow[]>;
  markExpiredStalePending(before: Date): Promise<number>;
  purgeTerminalRows(before: Date): Promise<number>;
}
