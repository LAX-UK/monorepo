export type RecordThirdPartySaleCommand = {
  editionId: string;
  sellerPartyId: string;
  buyerPartyId: string;
  grossPence: number;
  actorSubjectId: string;
};

export type RecordThirdPartySaleResult = {
  saleId: string;
  status: "draft";
};

export interface ThirdPartySaleWriter {
  recordSale(command: RecordThirdPartySaleCommand): Promise<RecordThirdPartySaleResult>;
}
