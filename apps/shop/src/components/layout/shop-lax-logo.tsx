import { cn } from "@auction/ui";
import Image from "next/image";

export const SHOP_LOGO_PATH = "/shop/lax-shop-logo.svg";

type ShopLaxLogoProps = {
  variant?: "header" | "footer";
  className?: string;
};

/** Shop-owned mark. Light-on-dark is the same asset inverted in CSS — no Bid lockup. */
export function ShopLaxLogo({ variant = "header", className }: ShopLaxLogoProps) {
  const width = variant === "footer" ? 313 : 201;
  const height = variant === "footer" ? 60 : 44;

  return (
    <span className={cn("shop-logo", className)}>
      <Image
        src={SHOP_LOGO_PATH}
        alt=""
        width={width}
        height={height}
        priority={variant === "header"}
        unoptimized
        className="shop-logo__mark"
      />
    </span>
  );
}
