import { cn } from "@auction/ui";
import type { ReactNode } from "react";

export const SALE_CARD_SHELL_CLASSNAME = cn(
  "group/card rounded-lg bg-page-bg p-4 sm:p-5 lg:p-6",
  "outline outline-1 -outline-offset-1 outline-outline-variant/60 dark:bg-surface-container-low",
  "motion-safe:transition-[transform,box-shadow] motion-safe:duration-300 motion-safe:ease-out",
  "motion-safe:hover:-translate-y-0.5 motion-safe:hover:shadow-md",
  "focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2 focus-within:ring-offset-page-bg",
);

type Props = {
  children: ReactNode;
  className?: string;
};

/** Visual chrome only (SRP) — use `SALE_CARD_SHELL_CLASSNAME` on `<Link>` when the whole card is clickable. */
export function SaleCardShell({ children, className }: Props) {
  return <div className={cn(SALE_CARD_SHELL_CLASSNAME, className)}>{children}</div>;
}
