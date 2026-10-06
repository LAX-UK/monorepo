import { cn } from "@auction/ui";
import { Button, type ButtonProps } from "@auction/ui/components/button";
import Link from "next/link";
import type { ComponentProps } from "react";

type ShopCommerceButtonProps = ButtonProps & {
  href?: string;
};

/** Primary commerce actions — 44px tap target, shared focus ring. */
export function ShopCommerceButton({
  href,
  variant = "cta",
  size = "md",
  className,
  children,
  ...props
}: ShopCommerceButtonProps) {
  const classes = cn("shop-focus-ring", className);
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
    <Button asChild variant="outline" size="md" className={cn("shop-focus-ring", className)}>
      <Link href={href} {...props}>
        {children}
      </Link>
    </Button>
  );
}
