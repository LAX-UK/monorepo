import { LAX_PRODUCT_NAMES, type LaxBrandProduct } from "@auction/branding";

/**
 * The From header for a product's mail. A configured value that is only an address is sent under
 * the product's own name; a full "Name <address>" is used as written; a product with no entry
 * falls back to the one From the service has always used.
 */
export function fromForProduct(
  product: LaxBrandProduct,
  byProduct: Readonly<Record<string, string>> | undefined,
  fallback: string,
): string {
  const configured = byProduct?.[product]?.trim();
  if (!configured) return fallback;
  return configured.includes("<") ? configured : `${LAX_PRODUCT_NAMES[product]} <${configured}>`;
}
