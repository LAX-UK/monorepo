export type CreateStockHoldCommand = {
  editionId: string;
  clientPartyId: string;
  expiresAt: string;
  note?: string | undefined;
  actorSubjectId: string;
};

export type CreateStockHoldResult = {
  holdId: string;
  status: "active";
};

export type ReleaseStockHoldCommand = {
  holdId: string;
  actorSubjectId: string;
};

export type ReleaseStockHoldResult = {
  holdId: string;
  status: "released";
};

export interface StockHoldWriter {
  createHold(command: CreateStockHoldCommand): Promise<CreateStockHoldResult>;
  releaseHold(command: ReleaseStockHoldCommand): Promise<ReleaseStockHoldResult>;
}
