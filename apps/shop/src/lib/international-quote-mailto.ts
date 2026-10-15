import type { BasketView } from "@auction/shop-contracts";

export function internationalQuoteMailto(supportEmail: string, basket: BasketView): string {
  const items = basket.lines.map((line) => {
    const title = line.productTitle ?? line.artworkTitle ?? "Item";
    const sku = line.variantSku ? ` (SKU ${line.variantSku})` : "";
    return `- ${title}${sku} × ${line.quantity}`;
  });
  const body = [
    "Please send me a delivery quotation for:",
    ...items,
    "",
    "Delivery country:",
    "Delivery address:",
    "",
    `Basket reference: ${basket.basketId}`,
  ].join("\n");
  const query = new URLSearchParams({ subject: "International delivery quotation", body });
  return `mailto:${supportEmail}?${query.toString().replaceAll("+", "%20")}`;
}
