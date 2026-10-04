export type ShopFeatureFlagsSnapshot = {
  payouts: boolean;
  thirdPartySales: boolean;
  originalSales: boolean;
  merchandise: boolean;
};

export type ShopFeatureFlagsReader = {
  read(): ShopFeatureFlagsSnapshot;
};
