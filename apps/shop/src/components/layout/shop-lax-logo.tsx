import { LaxLogo } from "@auction/marketing-ui";

export const SHOP_LOGO_PATH = "/shop/lax-shop-logo.svg";

type ShopLaxLogoProps = {
  variant?: "header" | "footer";
  className?: string;
};

/** Shop-owned mark via shared {@link LaxLogo} (Shop asset path until unified CDN). */
export function ShopLaxLogo({ variant = "header", className }: ShopLaxLogoProps) {
  return <LaxLogo variant={variant} src={SHOP_LOGO_PATH} {...(className ? { className } : {})} />;
}
