import type { ReactNode } from "react";

/** The 32px tile at the start of a team row: initials, or an icon for an invitation. */
export function MemberInitials({ children }: { children: ReactNode }) {
  return (
    <span
      aria-hidden
      className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-container-high font-label text-label-3 leading-5 font-semibold text-on-surface"
    >
      {children}
    </span>
  );
}
