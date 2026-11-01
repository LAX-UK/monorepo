import { cn } from "@auction/ui";
import type { HTMLAttributes } from "react";

/** Utility and primary nav label (utility bar links), in sentence case. */
export const NAV_LABEL_CLASSES =
  "font-label text-sm font-medium leading-[21px] text-nav-text transition-colors hover:text-brand-900";

/** Mega-menu primary trigger label. */
export const MEGA_NAV_LABEL_CLASSES = "font-label text-sm font-medium leading-[21px]";

export type NavLabelProps = HTMLAttributes<HTMLSpanElement>;

export function NavLabel({ className, children, ...rest }: NavLabelProps) {
  return (
    <span className={cn(NAV_LABEL_CLASSES, className)} {...rest}>
      {children}
    </span>
  );
}
