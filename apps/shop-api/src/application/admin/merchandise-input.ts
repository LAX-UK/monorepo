import { SHOP_API_ERROR_CODES } from "@auction/shop-contracts";
import { ShopApiError } from "../../errors/shop-api-error.js";

function required(value: string, what: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new ShopApiError(SHOP_API_ERROR_CODES.VALIDATION, `${what} is required`, 400);
  }
  return trimmed;
}

/** Trims staff-typed text; a blank description is stored as no description. */
export function cleanProductFields(input: {
  slug: string;
  title: string;
  description: string | null;
}): { slug: string; title: string; description: string | null } {
  return {
    slug: required(input.slug, "Slug"),
    title: required(input.title, "Title"),
    description: input.description?.trim() || null,
  };
}

export function cleanSku(sku: string): string {
  return required(sku, "SKU");
}
