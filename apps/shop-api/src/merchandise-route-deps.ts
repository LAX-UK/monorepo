import type { createGetPublicMerchandiseProductHandler } from "./application/handlers/get-public-merchandise-product.handler.js";
import type { createListPublicMerchandiseProductsHandler } from "./application/handlers/list-public-merchandise-products.handler.js";

export type MerchandiseRoutesDeps = {
  listPublicMerchandiseProducts: ReturnType<typeof createListPublicMerchandiseProductsHandler>;
  getPublicMerchandiseProduct: ReturnType<typeof createGetPublicMerchandiseProductHandler>;
};
