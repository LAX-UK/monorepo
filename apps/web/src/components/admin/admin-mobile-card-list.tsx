"use client";

import type { ReactNode } from "react";

type Props<T> = {
  rows: readonly T[];
  getRowId: (row: T) => string;
  children: (row: T) => ReactNode;
  className?: string;
};

/** Stacked mobile cards for admin list pages (used below md when table is hidden). */
export function AdminMobileCardList<T>({ rows, getRowId, children, className }: Props<T>) {
  if (rows.length === 0) return null;
  return (
    <ul className={className ?? "space-y-3 md:hidden"}>
      {rows.map((row) => (
        <li
          key={getRowId(row)}
          className="rounded-lg border border-border-hairline bg-surface-container-low/30 p-3"
        >
          {children(row)}
        </li>
      ))}
    </ul>
  );
}
