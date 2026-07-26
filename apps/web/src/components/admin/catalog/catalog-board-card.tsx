import { cn } from "@auction/ui";
import type { ReactNode } from "react";

/** Shared board card surface — neutral border, page-level elevation. */
export const catalogBoardCardClassName =
  "overflow-hidden rounded-shell-card border border-shell-stroke bg-surface-container-lowest shadow-[var(--shadow-rest)]";

type Props = {
  children: ReactNode;
  className?: string;
};

/** Standard list-board container for admin catalog, finance, people, and queue tables. */
export function CatalogBoardCard({ children, className }: Props) {
  return <div className={cn(catalogBoardCardClassName, className)}>{children}</div>;
}
