import { FOCUS_RING, MARKETING_CARD_LIFT } from "@/lib/marketing/chrome";
import { cn } from "@auction/ui";
import Link from "next/link";
import type { ComponentPropsWithoutRef, ReactNode } from "react";

export type MarketingLinkCardProps = Omit<ComponentPropsWithoutRef<typeof Link>, "className"> & {
  children: ReactNode;
  className?: string;
};

/** Card-as-link hover/focus shell (catalog tiles, rail cards). */
export function MarketingLinkCard({ className, children, ...rest }: MarketingLinkCardProps) {
  return (
    <Link
      className={cn(
        "group relative block overflow-hidden rounded-lg",
        MARKETING_CARD_LIFT,
        FOCUS_RING,
        className,
      )}
      {...rest}
    >
      {children}
    </Link>
  );
}
