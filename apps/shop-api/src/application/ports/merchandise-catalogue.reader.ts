export type PublicMerchandiseProductRecord = {
  slug: string;
  title: string;
  fromPricePence: number;
};

export type ListPublicMerchandiseProductsResult = {
  items: PublicMerchandiseProductRecord[];
};

export interface MerchandiseCatalogueReader {
  listPublicProducts(): Promise<ListPublicMerchandiseProductsResult>;
}
