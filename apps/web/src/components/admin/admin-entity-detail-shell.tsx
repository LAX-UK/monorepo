import { DetailRailLayout } from "@/components/admin/detail-rail/detail-rail-layout";
import { EntityDetailMeta } from "@/components/admin/entity-detail-meta";
import { AppScreen } from "@/components/dashboard/dashboard-page";
import { DashboardDetailHeader } from "@/components/dashboard/primitives/dashboard-detail-header";
import { DashboardPageHeader } from "@/components/dashboard/primitives/dashboard-page-header";
import type { ReactNode } from "react";

export type AdminEntityDetailShellProps = {
  breadcrumbs?: ReactNode;
  title: ReactNode;
  description?: string | undefined;
  meta?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  /** Stripe-style sticky context rail (lg+) with mobile sheet */
  rail?: ReactNode;
  railSticky?: boolean;
  className?: string | undefined;
  /** Use sticky `DashboardDetailHeader` (v3) instead of `DashboardPageHeader`. */
  detailHeader?: boolean;
  detailHeaderSticky?: boolean;
  backHref?: string;
  backLabel?: string;
  eyebrow?: ReactNode;
  entityId?: string;
  updatedAt?: Date | string;
  publicHref?: string;
  publicLabel?: string;
};

export function AdminEntityDetailShell({
  breadcrumbs,
  title,
  description,
  meta,
  actions,
  children,
  rail,
  railSticky = true,
  className,
  detailHeader = false,
  detailHeaderSticky = true,
  backHref,
  backLabel,
  eyebrow,
  entityId,
  updatedAt,
  publicHref,
  publicLabel,
}: AdminEntityDetailShellProps) {
  const contextRail = rail;

  return (
    <AppScreen className={className ?? "space-y-8"}>
      {detailHeader ? (
        <DashboardDetailHeader
          sticky={detailHeaderSticky}
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
      <EntityDetailMeta
        {...(entityId ? { entityId } : {})}
        {...(updatedAt ? { updatedAt } : {})}
        {...(publicHref ? { publicHref, publicLabel } : {})}
      />
      {contextRail ? (
        <DetailRailLayout rail={contextRail} sticky={railSticky}>
          {children}
        </DetailRailLayout>
      ) : (
        <div className="mx-auto max-w-6xl">
          <div className="min-w-0 space-y-6">{children}</div>
        </div>
      )}
    </AppScreen>
  );
}
