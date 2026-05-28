import { cn } from "@auction/ui";
import { Surface } from "@auction/ui/components/surface";
import type { ReactNode } from "react";

export type DashboardListRowCardProps = {
  className?: string;
  /** Checkbox or other control beside the row body. */
  leading?: ReactNode;
  thumbnail?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  trailing?: ReactNode;
  badges?: ReactNode;
  /** Extra row below title block (countdown, meta). */
  afterBadges?: ReactNode;
  footer?: ReactNode;
  /** Indent footer to align with text after a size-14 thumbnail. */
  footerIndented?: boolean;
};

/** Composable mobile list row card — shared Surface + flex layout for dashboard lists. */
export function DashboardListRowCard({
  className,
  leading,
  thumbnail,
  title,
  subtitle,
  trailing,
  badges,
  afterBadges,
  footer,
  footerIndented = false,
}: DashboardListRowCardProps) {
  return (
    <Surface variant="card" padding="md" className={className}>
      <div className="flex gap-3">
        {leading}
        <div className="min-w-0 flex-1">
          <div className="flex gap-3">
            {thumbnail}
            <div className="min-w-0 flex-1">
              <div className={cn(trailing && "flex items-start justify-between gap-2")}>
                <div className="min-w-0 flex-1">
                  {title}
                  {subtitle}
                </div>
                {trailing}
              </div>
              {badges ? (
                <div className="mt-2 flex flex-wrap items-center gap-2">{badges}</div>
              ) : null}
              {afterBadges}
            </div>
          </div>
          {footer ? (
            <div
              className={cn(
                "mt-3 flex flex-wrap gap-2",
                footerIndented && "pl-[calc(3.5rem+0.75rem)]",
              )}
            >
              {footer}
            </div>
          ) : null}
        </div>
      </div>
    </Surface>
  );
}

/** Wrapper for dashboard mobile list routes — hidden at `lg+`. */
export function DashboardMobileList({
  children,
  className,
}: { children: ReactNode; className?: string }) {
  return <ul className={cn("space-y-3 lg:hidden", className)}>{children}</ul>;
}

/** Wrapper for desktop table/card list blocks — visible at `lg+`. */
export function DashboardDesktopList({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "hidden overflow-hidden rounded-xl border border-border-hairline bg-surface-container-lowest shadow-sm lg:block",
        className,
      )}
    >
      {children}
    </div>
  );
}
