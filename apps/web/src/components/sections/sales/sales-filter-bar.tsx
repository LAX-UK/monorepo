import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
};

/** Second nav row: filter-style chips. Add more chip components as `children` without changing this shell (OCP).
 */
export function SalesFilterBar({ children }: Props) {
  return (
    <div
      className="flex min-h-10 w-full min-w-0 flex-wrap items-center gap-4 border-b border-outline-variant/40 py-3 sm:gap-6"
      role="toolbar"
      aria-label="Catalog filters"
    >
      {children}
    </div>
  );
}
