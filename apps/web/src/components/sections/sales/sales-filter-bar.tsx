import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
};

/**
 * Second nav row: filter-style chips. Add more chip components as `children` without changing this shell (OCP).
 */
export function SalesFilterBar({ children }: Props) {
  return (
    <div
      className="flex h-10 w-full min-w-0 flex-wrap items-center gap-8 border-b border-brand-100 sm:gap-12 dark:border-outline-variant/40"
      role="toolbar"
      aria-label="Catalog filters"
    >
      {children}
    </div>
  );
}
