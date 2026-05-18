import { AppScreen } from "@/components/dashboard/dashboard-page";
import { DashboardPageHeader } from "@/components/dashboard/primitives/dashboard-page-header";
import type { ReactNode } from "react";

export type AdminPanelPageProps = {
  title: string;
  description?: string | undefined;
  breadcrumbs?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string | undefined;
};

/** Non-list admin surfaces (stubs, settings hubs, integrations). */
export function AdminPanelPage({
  title,
  description,
  breadcrumbs,
  actions,
  children,
  className,
}: AdminPanelPageProps) {
  return (
    <AppScreen className={className ?? "space-y-6"}>
      <DashboardPageHeader
        title={title}
        {...(description ? { description } : {})}
        {...(breadcrumbs ? { breadcrumbs } : {})}
        {...(actions ? { actions } : {})}
      />
      {children}
    </AppScreen>
  );
}
