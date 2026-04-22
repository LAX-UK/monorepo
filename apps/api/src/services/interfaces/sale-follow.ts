export type SaleFollowRow = {
  id: string;
  userId: string;
  saleId: string;
  createdAt: Date;
};

/** ISP: existence-check interface used by the follow service to validate the sale. */
export interface ISaleExistenceReader {
  findById(id: string): Promise<{ id: string } | null>;
}

export interface ISaleFollowRepository {
  add(userId: string, saleId: string): Promise<SaleFollowRow>;
  remove(userId: string, saleId: string): Promise<void>;
  exists(userId: string, saleId: string): Promise<boolean>;
  countForSale(saleId: string): Promise<number>;
}
