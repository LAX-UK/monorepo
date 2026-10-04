import { SHOP_API_ERROR_CODES } from "@auction/shop-contracts";
import { SHOP_FULFILMENT_STATUSES, type ShopFulfilmentStatus } from "@auction/shop-domain";
import { ShopApiError } from "../../errors/shop-api-error.js";

export const POSSESSION_FULFILMENT_STATUSES: readonly ShopFulfilmentStatus[] = [
  "delivered",
  "collected",
  "in_storage",
];

export function parseFulfilmentStatus(raw: string): ShopFulfilmentStatus {
  if ((SHOP_FULFILMENT_STATUSES as readonly string[]).includes(raw)) {
    return raw as ShopFulfilmentStatus;
  }
  throw new ShopApiError(SHOP_API_ERROR_CODES.VALIDATION, "Invalid fulfilment status", 400);
}

export function policyNotConfigured(feature: string): never {
  throw new ShopApiError(
    SHOP_API_ERROR_CODES.POLICY_NOT_CONFIGURED,
    `${feature} is blocked until cancellation policy is configured`,
    501,
  );
}
