import type { createListPublicMerchandiseProductsHandler } from "./application/handlers/list-public-merchandise-products.handler.js";

export type MerchandiseRoutesDeps = {
  listPublicMerchandiseProducts: ReturnType<typeof createListPublicMerchandiseProductsHandler>;
};
