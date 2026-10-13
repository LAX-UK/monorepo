import { LAX_LOGO_DIMENSIONS, LAX_LOGO_PUBLIC_PATH } from "@auction/branding";
import { cn } from "@auction/ui";
import Image from "next/image";

export type LaxLogoProps = {
  variant?: "header" | "footer";
  /** When true, inverts the mark for dark header/footer bands. */
  inverted?: boolean;
  className?: string;
  /** Override asset path (Shop may keep /shop/lax-shop-logo.svg until migrated). */
  src?: string;
};

export function LaxLogo({
  variant = "header",
  inverted = false,
  className,
  src = LAX_LOGO_PUBLIC_PATH,
}: LaxLogoProps) {
  const { width, height } = LAX_LOGO_DIMENSIONS[variant];
  return (
    <span className={cn("shop-logo", inverted && "shop-logo--inverted", className)}>
      <Image
        src={src}
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
