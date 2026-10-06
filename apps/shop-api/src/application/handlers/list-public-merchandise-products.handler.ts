import type { MerchandiseCatalogueReader } from "../ports/merchandise-catalogue.reader.js";

export function createListPublicMerchandiseProductsHandler(reader: MerchandiseCatalogueReader) {
  return () => reader.listPublicProducts();
}
