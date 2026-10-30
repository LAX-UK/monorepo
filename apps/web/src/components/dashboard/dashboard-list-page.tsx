"use client";

import { DashboardPage } from "@/components/dashboard/dashboard-page";
import { DashboardPageHeader } from "@/components/dashboard/primitives/dashboard-page-header";
import { useClientLayout } from "@/components/layout/client-layout-context";
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

/**
 * Standard client list layout: header, tabs, toolbar, content. In the workspace a page-level
 * notice (Pay now) sits above the header; on the public site the shared account template puts
 * the title first and the notice under it, as the first thing in the content.
 */
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
  const bannerFirst = useClientLayout() === "workspace";
  return (
    <DashboardPage className={cn("space-y-5", className)}>
      {bannerFirst ? banner : null}
      <DashboardPageHeader
        // In the workspace on phones the title is in the top bar, so the header is only its
        // actions: they keep the list rhythm (20px) to the content below rather than touching it.
        {...(bannerFirst ? { className: "max-lg:mb-5" } : {})}
        meta={meta}
        title={title}
        // The workspace header sets its own margin to zero, which beats the page rhythm; this
        // gives it the standard 16px to the tabs or list below (the action on phones).
        {...(bannerFirst ? { className: "mb-4" } : {})}
        {...(description ? { description } : {})}
        {...(actions ? { actions } : {})}
      />
      {bannerFirst ? null : banner}
      {tabs}
      {errorAlert}
      {toolbar}
      {children}
    </DashboardPage>
  );
}
