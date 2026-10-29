import { cn } from "@auction/ui";
import type { CSSProperties, ReactNode } from "react";

/**
 * The one content column of the organisation workspace. The workspace shell sets
 * `--workspace-page-max` (see `WORKSPACE_COLUMN_STYLE`); elsewhere it is unset and the column
 * takes the frame's own width, so personal pages on the public site and staff pages keep theirs.
 */
export const WORKSPACE_PAGE_WIDTH_CLASS = "mx-auto w-full max-w-[var(--workspace-page-max)]";

/**
 * Every workspace page, list, form and Home alike, starts at the same x: 64rem, the Organisation
 * page's column, centred in the main area.
 */
export const WORKSPACE_COLUMN_STYLE = { "--workspace-page-max": "64rem" } as CSSProperties;

/** Consistent outer chrome for dashboard routes: width, padding, vertical rhythm. */
export function DashboardPage({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      aria-label="Dashboard content"
      className={cn("screen space-y-8 md:space-y-10", WORKSPACE_PAGE_WIDTH_CLASS, className)}
    >
      {children}
    </section>
  );
}

/** Same shell as {@link DashboardPage} for staff/admin surfaces. */
export const AppScreen = DashboardPage;
