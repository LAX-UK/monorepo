export type AdminSaleOperationsSaleRow = {
  id: string;
  title: string;
  status: string;
  deliveryMode: string;
  startTime: Date | null;
  locationName: string | null;
  streamUrl: string | null;
};

export type AdminSaleOperationsSessionRow = {
  status: string;
  currentLotId: string | null;
};

export type AdminSaleOperationsCurrentLotRow = {
  lotNumber: number | null;
  title: string;
  currentPrice: string;
};

export type AdminSaleOperationsCurrentLotBidding = {
  currentPrice: string;
  leaderRef: string | null;
  bidCount: number;
};

export interface IAdminSaleOperationsSnapshotReader {
  findSaleroomSale(saleId: string): Promise<AdminSaleOperationsSaleRow | null>;
  listActiveSaleroomSaleIds(limit: number): Promise<string[]>;
  findSession(saleId: string): Promise<AdminSaleOperationsSessionRow | null>;
  findCurrentLot(lotId: string): Promise<AdminSaleOperationsCurrentLotRow | null>;
  loadCurrentLotBidding(lotId: string): Promise<AdminSaleOperationsCurrentLotBidding | null>;
}
