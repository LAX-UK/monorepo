export const SHOP_API_ERROR_CODES = {
  VALIDATION: "shop.validation",
  NOT_FOUND: "shop.not_found",
  CONFLICT: "shop.conflict",
  INTERNAL: "shop.internal",
  OUT_OF_STOCK: "shop.out_of_stock",
  BASKET_CONFLICT: "shop.basket_conflict",
  PRICE_CHANGED: "shop.price_changed",
  PAYMENT_FAILED: "shop.payment_failed",
  UNAUTHORIZED: "shop.unauthorized",
  FORBIDDEN: "shop.forbidden",
} as const;

export type ShopApiErrorCode = (typeof SHOP_API_ERROR_CODES)[keyof typeof SHOP_API_ERROR_CODES];
