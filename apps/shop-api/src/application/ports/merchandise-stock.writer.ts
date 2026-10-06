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

export interface MerchandiseStockWriter {
  adjustVariantOnHand(
    input: AdjustMerchandiseVariantStockInput,
  ): Promise<AdjustMerchandiseVariantStockResult>;
}
