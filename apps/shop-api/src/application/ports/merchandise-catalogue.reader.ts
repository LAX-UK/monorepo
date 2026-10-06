import type { CatalogueCursor } from "../catalogue-cursor.js";

export const DEFAULT_PUBLIC_MERCH_LIMIT = 20;
export const MAX_PUBLIC_MERCH_LIMIT = 50;

export type PublicMerchandiseProductRecord = {
  slug: string;
  title: string;
  fromPricePence: number;
};

export type PublicMerchandiseVariantRecord = {
  variantId: string;
  sku: string;
  pricePence: number;
  availableCount: number;
};

export type PublicMerchandiseProductDetailRecord = {
  slug: string;
  title: string;
  description: string | null;
  variants: PublicMerchandiseVariantRecord[];
};

export type ListPublicMerchandiseProductsInput = {
  limit: number;
  cursor?: CatalogueCursor | null;
};

export type ListPublicMerchandiseProductsResult = {
  items: PublicMerchandiseProductRecord[];
  nextCursor?: string;
};

export interface MerchandiseCatalogueReader {
  listPublicProducts(
    input: ListPublicMerchandiseProductsInput,
  ): Promise<ListPublicMerchandiseProductsResult>;
  getPublicProductBySlug(slug: string): Promise<PublicMerchandiseProductDetailRecord | null>;
}
