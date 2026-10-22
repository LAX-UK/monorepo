type StaffWrite = {
  actorSubjectId: string;
  idempotencyKey: string;
};

export type UpdateMerchandiseProductInput = StaffWrite & {
  productId: string;
  slug: string;
  title: string;
  description: string | null;
  /** The product's `updatedAt` when the editor opened it. */
  expectedVersion: string;
};

export type MerchandiseVariantFields = {
  sku: string;
  pricePence: number;
};

export type AddMerchandiseVariantInput = StaffWrite &
  MerchandiseVariantFields & {
    productId: string;
  };

export type UpdateMerchandiseVariantInput = StaffWrite &
  MerchandiseVariantFields & {
    variantId: string;
  };

export type SetMerchandiseArchivedInput = StaffWrite & {
  archived: boolean;
};

/**
 * Staff edits to the merchandise catalogue. Nothing is ever deleted: order lines reference
 * products and variants, so withdrawing from sale is an archive. Stock is not written here;
 * it only changes through `MerchandiseStockWriter`, which records why.
 *
 * Every method throws `ShopApiError` for a missing row (404) or a taken slug or SKU (409), and
 * `StaleVersionError` when `expectedVersion` is out of date.
 */
export interface MerchandiseCatalogueWriter {
  updateProduct(input: UpdateMerchandiseProductInput): Promise<{ version: string }>;
  setProductArchived(
    input: SetMerchandiseArchivedInput & { productId: string },
  ): Promise<{ version: string }>;
  addVariant(input: AddMerchandiseVariantInput): Promise<{ variantId: string }>;
  updateVariant(input: UpdateMerchandiseVariantInput): Promise<{ variantId: string }>;
  setVariantArchived(
    input: SetMerchandiseArchivedInput & { variantId: string },
  ): Promise<{ variantId: string }>;
}
