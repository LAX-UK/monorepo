import type { ReactNode } from "react";

/** Shared bordered tab content wrapper for admin entity detail pages. */
export function AdminEntityTabPanel({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-border-hairline bg-surface-container-low/40 p-6">
      {children}
    </div>
  );
}
