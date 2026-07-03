export type LotTransitionGuardCounts = {
  paymentCount: number;
  openDisputeCount: number;
  fulfilmentInProgress: boolean;
  activeBidCount: number;
};

export interface ILotTransitionGuardReader {
  countForLot(lotId: string): Promise<LotTransitionGuardCounts>;
  assertReturnToInventoryAllowed(lotId: string): Promise<string | null>;
}
