import { type Static, Type } from "@sinclair/typebox";
import { createCursorListResponseSchema } from "./cursor-list.js";

/** Lower-case words joined by single hyphens, so every slug is a clean URL segment. */
export const MERCHANDISE_SLUG_PATTERN = "^[a-z0-9]+(?:-[a-z0-9]+)*$";

export const MERCHANDISE_TITLE_MAX_LENGTH = 200;
export const MERCHANDISE_SLUG_MAX_LENGTH = 120;
export const MERCHANDISE_SKU_MAX_LENGTH = 64;
export const MERCHANDISE_DESCRIPTION_MAX_LENGTH = 4000;
export const MERCHANDISE_STOCK_REASON_MAX_LENGTH = 200;
/** £100,000 in pence: far above any product, and well inside the integer column. */
export const MERCHANDISE_PRICE_MAX_PENCE = 10_000_000;

/**
 * The 409 messages for a clash on a unique value. The admin tells the two apart by message, so
 * both sides import these instead of repeating the text.
 */
export const MERCHANDISE_SLUG_IN_USE_MESSAGE = "That slug is already in use.";
export const MERCHANDISE_SKU_IN_USE_MESSAGE = "That SKU is already in use.";

export const MerchandiseStatusSchema = Type.Union([
  Type.Literal("active"),
  Type.Literal("archived"),
]);
export type MerchandiseStatus = Static<typeof MerchandiseStatusSchema>;

/** A row's `updatedAt`, handed back as `expectedVersion` so a stale save is refused. */
export const MerchandiseVersionSchema = Type.String({ format: "date-time", maxLength: 40 });

const SlugSchema = Type.String({
  minLength: 1,
  maxLength: MERCHANDISE_SLUG_MAX_LENGTH,
  pattern: MERCHANDISE_SLUG_PATTERN,
});
const TitleSchema = Type.String({ minLength: 1, maxLength: MERCHANDISE_TITLE_MAX_LENGTH });
const DescriptionSchema = Type.Union([
  Type.String({ maxLength: MERCHANDISE_DESCRIPTION_MAX_LENGTH }),
  Type.Null(),
]);
const SkuSchema = Type.String({ minLength: 1, maxLength: MERCHANDISE_SKU_MAX_LENGTH });
const PricePenceSchema = Type.Integer({ minimum: 0, maximum: MERCHANDISE_PRICE_MAX_PENCE });
const StockSchema = Type.Integer({ minimum: 0 });

export const MerchandiseProductCreateBodySchema = Type.Object({
  slug: SlugSchema,
  title: TitleSchema,
  description: Type.Optional(DescriptionSchema),
  sku: SkuSchema,
  pricePence: PricePenceSchema,
  onHand: StockSchema,
});

export const MerchandiseProductCreateResponseSchema = Type.Object({
  productId: Type.String({ format: "uuid" }),
  variantId: Type.String({ format: "uuid" }),
  slug: Type.String(),
});

export const MerchandiseProductUpdateBodySchema = Type.Object({
  slug: SlugSchema,
  title: TitleSchema,
  description: DescriptionSchema,
  expectedVersion: MerchandiseVersionSchema,
});

export const MerchandiseVersionResponseSchema = Type.Object({ version: MerchandiseVersionSchema });

export const MerchandiseVariantBodySchema = Type.Object({
  sku: SkuSchema,
  pricePence: PricePenceSchema,
});

export const MerchandiseVariantResponseSchema = Type.Object({
  variantId: Type.String({ format: "uuid" }),
});

export const MerchandiseAdjustStockBodySchema = Type.Object({
  onHand: StockSchema,
  reason: Type.String({ minLength: 3, maxLength: MERCHANDISE_STOCK_REASON_MAX_LENGTH }),
});

export const MerchandiseAdjustStockResponseSchema = Type.Object({
  variantId: Type.String({ format: "uuid" }),
  onHand: StockSchema,
});

export const MerchandiseVariantDetailSchema = Type.Object({
  variantId: Type.String({ format: "uuid" }),
  sku: Type.String(),
  pricePence: Type.Integer(),
  onHand: Type.Integer(),
  reserved: Type.Integer(),
  status: MerchandiseStatusSchema,
});

export const MerchandiseProductDetailSchema = Type.Object({
  productId: Type.String({ format: "uuid" }),
  slug: Type.String(),
  title: Type.String(),
  description: Type.Union([Type.String(), Type.Null()]),
  status: MerchandiseStatusSchema,
  version: MerchandiseVersionSchema,
  createdAt: Type.String({ format: "date-time" }),
  variants: Type.Array(MerchandiseVariantDetailSchema),
});

export const MerchandiseProductListQuerySchema = Type.Object({
  cursor: Type.Optional(Type.String()),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 })),
  q: Type.Optional(Type.String({ maxLength: 100 })),
  status: Type.Optional(MerchandiseStatusSchema),
});

export const MerchandiseProductListItemSchema = Type.Object({
  productId: Type.String({ format: "uuid" }),
  slug: Type.String(),
  title: Type.String(),
  status: MerchandiseStatusSchema,
  /** Variants still on sale; archived variants are not counted. */
  variantCount: Type.Integer(),
  fromPricePence: Type.Union([Type.Integer(), Type.Null()]),
  toPricePence: Type.Union([Type.Integer(), Type.Null()]),
  totalOnHand: Type.Integer(),
});

export const MerchandiseProductListSchema = createCursorListResponseSchema(
  MerchandiseProductListItemSchema,
);

/** 409 body: a stale save carries `currentVersion`; a clash on a unique value does not. */
export const MerchandiseConflictBodySchema = Type.Object({
  code: Type.String(),
  message: Type.String(),
  requestId: Type.Optional(Type.String()),
  currentVersion: Type.Optional(MerchandiseVersionSchema),
});

export type MerchandiseProductDetail = Static<typeof MerchandiseProductDetailSchema>;
export type MerchandiseVariantDetail = Static<typeof MerchandiseVariantDetailSchema>;
export type MerchandiseProductListItem = Static<typeof MerchandiseProductListItemSchema>;
export type MerchandiseProductList = Static<typeof MerchandiseProductListSchema>;
