import { cn } from "@auction/ui";
import { Button, type ButtonProps } from "@auction/ui/components/button";
import Link from "next/link";
import type { ComponentProps } from "react";

/**
 * Shop button scale:
 * - `commerce`: buy, checkout and pay (48px, 16px label).
 * - `standard`: every other action (40px, 14px label).
 */
export type ShopButtonScale = "commerce" | "standard";

export function shopButtonClassName(
  variant: ButtonProps["variant"],
  scale: ShopButtonScale,
  className?: string,
): string {
  return cn(
    "shop-button shop-focus-ring",
    scale === "commerce" ? "shop-button--commerce" : "shop-button--standard",
    variant === "cta" && "shop-button--primary",
    variant === "outline" && "shop-button--secondary",
    className,
  );
}

type ShopCommerceButtonProps = ButtonProps & {
  href?: string;
  scale?: ShopButtonScale;
};

/** Shop action button. Solid (`cta`) defaults to the commerce scale, other variants to standard. */
export function ShopCommerceButton({
  href,
  variant = "cta",
  size = "md",
  scale,
  className,
  children,
  ...props
}: ShopCommerceButtonProps) {
  const classes = shopButtonClassName(
    variant,
    scale ?? (variant === "cta" ? "commerce" : "standard"),
    className,
  );
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
      size="md"
      className={shopButtonClassName("outline", "standard", className)}
    >
      <Link href={href} {...props}>
        {children}
      </Link>
    </Button>
  );
}
