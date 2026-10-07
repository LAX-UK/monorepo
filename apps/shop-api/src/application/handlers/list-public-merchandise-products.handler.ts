import { decodeCatalogueCursor } from "../catalogue-cursor.js";
import type { MerchandiseCatalogueReader } from "../ports/merchandise-catalogue.reader.js";
import { DEFAULT_PUBLIC_MERCH_LIMIT } from "../ports/merchandise-catalogue.reader.js";

export function createListPublicMerchandiseProductsHandler(reader: MerchandiseCatalogueReader) {
  return (input: { limit?: number; cursor?: string }) => {
    const limit = input.limit ?? DEFAULT_PUBLIC_MERCH_LIMIT;
    const cursor = decodeCatalogueCursor(input.cursor);
    return reader.listPublicProducts({ limit, cursor });
  };
}
