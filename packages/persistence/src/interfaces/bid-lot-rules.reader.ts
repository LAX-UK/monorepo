export type BidLotRulesRow = {
  saleId: string | null;
  autoBidEnabled: boolean | null;
  minBidIncrement: string;
  autoBidStepMin: string | null;
  autoBidStepMax: string | null;
  autoBidStepPresets: number[] | null;
};

export interface IBidLotRulesReader {
  findLotBidRules(lotId: string): Promise<BidLotRulesRow | null>;
}
