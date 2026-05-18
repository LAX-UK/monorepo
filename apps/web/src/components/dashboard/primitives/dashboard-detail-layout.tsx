import { DashboardPage } from "@/components/dashboard/dashboard-page";
import { DashboardPageHeader } from "@/components/dashboard/primitives/dashboard-page-header";
import { cn } from "@auction/ui";
import type { ReactNode } from "react";

export type DashboardDetailLayoutProps = {
  breadcrumbs?: ReactNode;
  title: string;
  description?: string;
  meta?: ReactNode;
  actions?: ReactNode;
  /** Custom header block (e.g. org avatar row) replaces default title row when set */
  headerSlot?: ReactNode;
  children: ReactNode;
  aside?: ReactNode;
  footer?: ReactNode;
  className?: string;
  maxWidthClassName?: string;
};

/** Client detail pages: header + main/aside grid + optional sticky footer. */
export function DashboardDetailLayout({
  breadcrumbs,
  title,
  description,
  meta,
  actions,
  headerSlot,
  children,
  aside,
  footer,
  className,
  maxWidthClassName = "max-w-6xl",
}: DashboardDetailLayoutProps) {
  return (
    <DashboardPage className={cn("space-y-8", className)}>
      {headerSlot ?? (
        <DashboardPageHeader
          title={title}
          {...(description ? { description } : {})}
          {...(meta ? { meta } : {})}
          {...(breadcrumbs ? { breadcrumbs } : {})}
          {...(actions ? { actions } : {})}
        />
      )}
      <div
        className={cn(
          "mx-auto gap-8",
          maxWidthClassName,
          aside ? "grid lg:grid-cols-[minmax(0,1fr)_minmax(16rem,22rem)]" : "",
        )}
      >
        <div className="min-w-0 space-y-6">{children}</div>
        {aside ? <aside className="min-w-0 space-y-4">{aside}</aside> : null}
      </div>
      {footer}
    </DashboardPage>
  );
}
