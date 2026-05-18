import type { ReactNode } from "react";
import { cn } from "../../lib/utils.js";

export type StickySaveBarProps = {
  children: ReactNode;
  className?: string;
  /** When true, adds bottom padding for client mobile bottom tab bar */
  reserveBottomNav?: boolean;
};

/** Sticky form actions — respects safe area and optional bottom nav height. */
export function StickySaveBar({
  children,
  className,
  reserveBottomNav = false,
}: StickySaveBarProps) {
  return (
    <div
      className={cn(
        "sticky bottom-0 z-10 -mx-4 w-[calc(100%+2rem)] border-t border-border-hairline bg-surface-container-lowest/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-surface-container-lowest/80 md:-mx-0 md:w-full md:px-0",
        reserveBottomNav && "pb-[max(0.75rem,var(--bottom-nav-height,0px))] lg:pb-3",
        className,
      )}
    >
      {children}
    </div>
  );
}
