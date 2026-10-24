import { SHOP_API_ERROR_CODES } from "@auction/shop-contracts";
import type { FastifyRequest } from "fastify";
import { ShopApiError } from "../errors/shop-api-error.js";

export const IDEMPOTENCY_KEY_MIN_LENGTH = 8;
export const IDEMPOTENCY_KEY_MAX_LENGTH = 128;

/** Visible ASCII only, so a key is safe to store, log and compare. */
const IDEMPOTENCY_KEY_PATTERN = /^[\x21-\x7e]+$/;

export function requireIdempotencyKey(request: FastifyRequest): string {
  const raw = request.headers["idempotency-key"];
  const key = typeof raw === "string" ? raw.trim() : "";
  if (key.length < IDEMPOTENCY_KEY_MIN_LENGTH) {
    throw new ShopApiError(
      SHOP_API_ERROR_CODES.VALIDATION,
      "Idempotency-Key header is required",
      400,
    );
  }
  if (key.length > IDEMPOTENCY_KEY_MAX_LENGTH || !IDEMPOTENCY_KEY_PATTERN.test(key)) {
    throw new ShopApiError(
      SHOP_API_ERROR_CODES.VALIDATION,
      `Idempotency-Key must be ${IDEMPOTENCY_KEY_MIN_LENGTH} to ${IDEMPOTENCY_KEY_MAX_LENGTH} visible characters`,
      400,
    );
  }
  return key;
}
