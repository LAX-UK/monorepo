import { cn } from "@auction/ui";
import type { ReactNode } from "react";

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
      className={cn("screen w-full space-y-8 md:space-y-10", className)}
    >
      {children}
    </section>
  );
}

/** Same shell as {@link DashboardPage} for staff/admin surfaces. */
export const AppScreen = DashboardPage;
