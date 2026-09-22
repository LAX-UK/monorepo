import { SHOP_API_ERROR_CODES, type ShopApiErrorCode } from "@auction/shop-contracts";

export class ShopApiError extends Error {
  readonly code: ShopApiErrorCode;
  readonly statusCode: number;

  constructor(code: ShopApiErrorCode, message: string, statusCode: number) {
    super(message);
    this.name = "ShopApiError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

export function notFound(message: string): ShopApiError {
  return new ShopApiError(SHOP_API_ERROR_CODES.NOT_FOUND, message, 404);
}
