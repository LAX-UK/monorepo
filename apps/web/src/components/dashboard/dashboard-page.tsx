import { cn } from "@auction/ui";
import type { ReactNode } from "react";

/**
 * A page's column takes the width of the frame it is in: the workspace shell's left-aligned
 * column of up to 1120px, the public site's column for personal pages, the staff page width.
 */
export const WORKSPACE_PAGE_WIDTH_CLASS = "w-full";

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
