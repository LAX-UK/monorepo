import { FOCUS_RING } from "@/lib/marketing/chrome";
import { cn } from "@auction/ui";
import Link from "next/link";
import type { ComponentPropsWithoutRef, ReactNode } from "react";

const shell =
  "group relative block overflow-hidden rounded-lg motion-safe:transition-transform motion-safe:duration-200 motion-safe:ease-out motion-reduce:transition-none motion-safe:group-hover:-translate-y-px motion-safe:group-hover:ring-1 motion-safe:group-hover:ring-primary/20";

export type MarketingLinkCardProps = Omit<ComponentPropsWithoutRef<typeof Link>, "className"> & {
  children: ReactNode;
  className?: string;
};

/** Card-as-link hover/focus shell (catalog tiles, rail cards). */
export function MarketingLinkCard({ className, children, ...rest }: MarketingLinkCardProps) {
  return (
    <Link className={cn(shell, FOCUS_RING, className)} {...rest}>
      {children}
    </Link>
  );
}
