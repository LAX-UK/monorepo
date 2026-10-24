import type { StaffProduct } from "@auction/staff-ui";

/**
 * The staff tools offered in the product switcher. LAX Admin is always here; Bid admin appears
 * when its address is configured. Bid admin applies its own permissions when it opens, so a
 * person without a Bid staff role who follows the link is told so there.
 */
export function staffProducts(config: { bidPublicUrl?: string | undefined }): StaffProduct[] {
  const products: StaffProduct[] = [
    {
      id: "lax-admin",
      name: "LAX Admin",
      description: "lax.art and LAX Shop: catalogue, orders, editorial",
      href: "/",
    },
  ];
  if (config.bidPublicUrl) {
    products.push({
      id: "bid-admin",
      name: "Bid admin",
      description: "LAX Bid: sales, lots, bidders and payments",
      href: `${config.bidPublicUrl}/admin`,
    });
  }
  return products;
}
