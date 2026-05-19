import { AppScreen } from "@/components/dashboard/dashboard-page";
import { DashboardDetailHeader } from "@/components/dashboard/primitives/dashboard-detail-header";
import { DashboardPageHeader } from "@/components/dashboard/primitives/dashboard-page-header";
import { cn } from "@auction/ui";
import type { ReactNode } from "react";

export type AdminEntityDetailShellProps = {
  breadcrumbs?: ReactNode;
  title: string;
  description?: string | undefined;
  meta?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  aside?: ReactNode;
  className?: string | undefined;
  /** Use sticky `DashboardDetailHeader` (v3) instead of `DashboardPageHeader`. */
  detailHeader?: boolean;
  backHref?: string;
  backLabel?: string;
  eyebrow?: ReactNode;
};

export function AdminEntityDetailShell({
  breadcrumbs,
  title,
  description,
  meta,
  actions,
  children,
  aside,
  className,
  detailHeader = false,
  backHref,
  backLabel,
  eyebrow,
}: AdminEntityDetailShellProps) {
  return (
    <AppScreen className={className ?? "space-y-8"}>
      {detailHeader ? (
        <DashboardDetailHeader
          sticky
          title={title}
          {...(description ? { description } : {})}
          {...(breadcrumbs ? { crumbs: breadcrumbs } : {})}
          {...(backHref && !breadcrumbs ? { backHref } : {})}
          {...(backLabel ? { backLabel } : {})}
          {...(eyebrow ? { eyebrow } : {})}
          badges={meta}
          actions={actions}
        />
      ) : (
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
          "mx-auto max-w-6xl gap-8",
          aside ? "grid lg:grid-cols-[minmax(0,1fr)_minmax(16rem,22rem)]" : "",
        )}
      >
        <div className="min-w-0 space-y-6">{children}</div>
        {aside ? <aside className="min-w-0 space-y-4">{aside}</aside> : null}
      </div>
    </AppScreen>
  );
}
