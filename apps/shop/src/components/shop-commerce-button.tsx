import { cn } from "@auction/ui";
import { BUTTON_SIZES, Button, type ButtonProps } from "@auction/ui/components/button";
import Link from "next/link";
import type { ComponentProps } from "react";

/**
 * Shop button scale, the family's two heights:
 * - `commerce`: buy, checkout and pay (the kit's `lg`, 44px).
 * - `standard`: every other action (the kit's `default`, 36px).
 */
export type ShopButtonScale = "commerce" | "standard";

/** The kit size each Shop scale uses. */
export const SHOP_BUTTON_SIZE = { commerce: "lg", standard: "default" } as const;

export function shopButtonClassName(
  variant: ButtonProps["variant"],
  scale: ShopButtonScale,
  className?: string,
): string {
  return cn(
    "shop-button shop-focus-ring",
    BUTTON_SIZES[SHOP_BUTTON_SIZE[scale]],
    scale === "commerce" ? "shop-button--commerce" : "shop-button--standard",
    variant === "cta" && "shop-button--primary",
    variant === "outline" && "shop-button--secondary",
    className,
  );
}

type ShopCommerceButtonProps = Omit<ButtonProps, "size"> & {
  href?: string;
  scale?: ShopButtonScale;
};

/** Shop action button. Solid (`cta`) defaults to the commerce scale, other variants to standard. */
export function ShopCommerceButton({
  href,
  variant = "cta",
  scale,
  className,
  children,
  ...props
}: ShopCommerceButtonProps) {
  const resolved = scale ?? (variant === "cta" ? "commerce" : "standard");
  const classes = shopButtonClassName(variant, resolved, className);
  const size = SHOP_BUTTON_SIZE[resolved];
  if (href) {
    return (
      <Button asChild variant={variant} size={size} className={classes}>
        <Link href={href}>{children}</Link>
      </Button>
    );
  }
  return (
    <Button variant={variant} size={size} className={classes} {...props}>
      {children}
    </Button>
  );
}

export function ShopCommerceOutlineLink({
  href,
  className,
  children,
  ...props
}: ComponentProps<typeof Link>) {
  return (
    <Button
      asChild
      variant="outline"
      size={SHOP_BUTTON_SIZE.standard}
      className={shopButtonClassName("outline", "standard", className)}
    >
      <Link href={href} {...props}>
        {children}
      </Link>
    </Button>
  );
}
