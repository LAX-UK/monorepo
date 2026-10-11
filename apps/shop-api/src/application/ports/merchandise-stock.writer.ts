export type AdjustMerchandiseVariantStockInput = {
  variantId: string;
  onHand: number;
  actorSubjectId: string;
  idempotencyKey: string;
};

export type AdjustMerchandiseVariantStockResult = {
  variantId: string;
  onHand: number;
};

export type CreateMerchandiseProductInput = {
  slug: string;
  title: string;
  description?: string | undefined;
  sku: string;
  pricePence: number;
  onHand: number;
  actorSubjectId: string;
  idempotencyKey: string;
};

export type CreateMerchandiseProductResult = {
  productId: string;
  variantId: string;
  slug: string;
};

export interface MerchandiseStockWriter {
  adjustVariantOnHand(
    input: AdjustMerchandiseVariantStockInput,
  ): Promise<AdjustMerchandiseVariantStockResult>;
  createProduct(input: CreateMerchandiseProductInput): Promise<CreateMerchandiseProductResult>;
}
