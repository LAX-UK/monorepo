import { Type } from "@sinclair/typebox";

export const PublicMerchandiseProductSchema = Type.Object(
  {
    slug: Type.String({ minLength: 1 }),
    title: Type.String({ minLength: 1 }),
    fromPricePence: Type.Integer({ minimum: 0 }),
  },
  { additionalProperties: false },
);

export const PublicMerchandiseProductListSchema = Type.Object({
  items: Type.Array(PublicMerchandiseProductSchema),
  nextCursor: Type.Optional(Type.String()),
});

export const PublicMerchandiseVariantSchema = Type.Object(
  {
    variantId: Type.String({ format: "uuid" }),
    sku: Type.String({ minLength: 1 }),
    pricePence: Type.Integer({ minimum: 0 }),
    availableCount: Type.Integer({ minimum: 0 }),
  },
  { additionalProperties: false },
);

export const PublicMerchandiseProductDetailSchema = Type.Object(
  {
    slug: Type.String({ minLength: 1 }),
    title: Type.String({ minLength: 1 }),
    description: Type.Union([Type.String(), Type.Null()]),
    variants: Type.Array(PublicMerchandiseVariantSchema),
  },
  { additionalProperties: false },
);

export type PublicMerchandiseProduct = typeof PublicMerchandiseProductSchema.static;
export type PublicMerchandiseProductList = typeof PublicMerchandiseProductListSchema.static;
export type PublicMerchandiseProductDetail = typeof PublicMerchandiseProductDetailSchema.static;
export type PublicMerchandiseVariant = typeof PublicMerchandiseVariantSchema.static;
