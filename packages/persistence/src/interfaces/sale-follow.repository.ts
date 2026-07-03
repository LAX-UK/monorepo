export type SaleFollowRow = {
  id: string;
  userId: string;
  saleId: string;
  createdAt: Date;
};

export interface ISaleFollowRepository {
  add(userId: string, saleId: string): Promise<SaleFollowRow>;
  remove(userId: string, saleId: string): Promise<void>;
  exists(userId: string, saleId: string): Promise<boolean>;
  countForSale(saleId: string): Promise<number>;
}
