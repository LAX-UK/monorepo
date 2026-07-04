export interface ILotNotifyReader {
  getLotTitle(lotId: string): Promise<string | null>;
}
