import { cn } from "@auction/ui";
import type { HTMLAttributes } from "react";

/** Utility / primary nav uppercase label (utility bar links). */
export const NAV_LABEL_CLASSES =
  "font-label text-sm font-medium uppercase leading-[21px] text-nav-text transition-colors hover:text-brand-900";

/** Footer column heading variant. */
export const FOOTER_NAV_LABEL_CLASSES =
  "font-label text-base font-bold uppercase leading-6 tracking-normal text-on-surface";

/** Mega-menu primary trigger label. */
export const MEGA_NAV_LABEL_CLASSES = "font-label text-sm font-medium uppercase leading-[21px]";

export type NavLabelProps = HTMLAttributes<HTMLSpanElement>;

export function NavLabel({ className, children, ...rest }: NavLabelProps) {
  return (
    <span className={cn(NAV_LABEL_CLASSES, className)} {...rest}>
      {children}
    </span>
  );
}
