import { AppScreen } from "@/components/dashboard/dashboard-page";
import { PageHeader } from "@auction/ui/components/page-header";
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
      <PageHeader
        title={title}
        {...(description ? { description } : {})}
        {...(breadcrumbs ? { breadcrumbs } : {})}
        {...(actions ? { actions } : {})}
      />
      {children}
    </AppScreen>
  );
}
