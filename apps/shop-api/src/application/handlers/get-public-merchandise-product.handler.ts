import type { MerchandiseCatalogueReader } from "../ports/merchandise-catalogue.reader.js";

export function createGetPublicMerchandiseProductHandler(reader: MerchandiseCatalogueReader) {
  return (slug: string) => reader.getPublicProductBySlug(slug);
}
