export type ShopReadinessPort = {
  checkConnectivity(): Promise<void>;
  checkCatalogueSchema(): Promise<void>;
};
