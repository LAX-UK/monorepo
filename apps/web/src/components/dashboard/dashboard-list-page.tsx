import { DashboardPage } from "@/components/dashboard/dashboard-page";
import { DashboardPageHeader } from "@/components/dashboard/primitives/dashboard-page-header";
import { cn } from "@auction/ui";
import type { ReactNode } from "react";

export type DashboardListPageProps = {
  meta?: ReactNode;
  title: string;
  description?: string;
  actions?: ReactNode;
  /** Optional alerts above the header (fetch warnings, org context). */
  banner?: ReactNode;
  tabs?: ReactNode;
  toolbar?: ReactNode;
  errorAlert?: ReactNode;
  children: ReactNode;
  className?: string;
};

/** Standard client dashboard list layout — header, tabs, toolbar, content. */
export function DashboardListPage({
  meta,
  title,
  description,
  actions,
  banner,
  tabs,
  toolbar,
  errorAlert,
  children,
  className,
}: DashboardListPageProps) {
  return (
    <DashboardPage className={cn("space-y-5", className)}>
      {banner}
      <DashboardPageHeader
        meta={meta}
        title={title}
        hideTitleOnMobile
        hideDescriptionOnMobile
        {...(description ? { description } : {})}
        {...(actions ? { actions } : {})}
      />
      {tabs}
      {errorAlert}
      {toolbar}
      {children}
    </DashboardPage>
  );
}
