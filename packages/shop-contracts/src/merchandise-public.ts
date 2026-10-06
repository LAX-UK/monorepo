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
});

export type PublicMerchandiseProduct = typeof PublicMerchandiseProductSchema.static;
export type PublicMerchandiseProductList = typeof PublicMerchandiseProductListSchema.static;
