import { SHOP_API_ERROR_CODES } from "@auction/shop-contracts";
import type { FastifyRequest } from "fastify";
import { ShopApiError } from "../errors/shop-api-error.js";

export function requireIdempotencyKey(request: FastifyRequest): string {
  const raw = request.headers["idempotency-key"];
  const key = typeof raw === "string" ? raw.trim() : "";
  if (key.length < 8) {
    throw new ShopApiError(
      SHOP_API_ERROR_CODES.VALIDATION,
      "Idempotency-Key header is required",
      400,
    );
  }
  return key;
}
