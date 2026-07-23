import type { ReactNode } from "react";
import { cn } from "../../lib/utils.js";

export type StickySaveBarProps = {
  children: ReactNode;
  className?: string;
  /** When false, renders inline at end of form flow (no sticky/fixed positioning). */
  sticky?: boolean;
  /** When true, adds bottom padding for client mobile bottom tab bar */
  reserveBottomNav?: boolean;
};

/** Form action footer — sticky by default; set sticky={false} for inline wizard footers. */
export function StickySaveBar({
  children,
  className,
  sticky = true,
  reserveBottomNav = false,
}: StickySaveBarProps) {
  return (
    <div
      className={cn(
        "border-t border-border-hairline bg-surface-container-lowest/95 py-3 backdrop-blur supports-[backdrop-filter]:bg-surface-container-lowest/80",
        sticky
          ? "sticky bottom-0 z-10 -mx-4 w-[calc(100%+2rem)] px-4 md:-mx-0 md:w-full md:px-0"
          : "mt-8",
        reserveBottomNav && "pb-[max(0.75rem,var(--bottom-nav-height,0px))] lg:pb-3",
        className,
      )}
    >
      {children}
    </div>
  );
}
