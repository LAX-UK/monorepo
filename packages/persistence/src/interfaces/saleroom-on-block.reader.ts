export type SaleroomOnBlockSession = {
  status: string | null;
  currentLotId: string | null;
};

export interface ISaleroomOnBlockReader {
  forConnection(conn: import("@auction/db").Database): ISaleroomOnBlockReader;
  getSessionState(saleId: string): Promise<SaleroomOnBlockSession | null>;
}
