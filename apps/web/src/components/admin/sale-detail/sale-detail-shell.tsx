import { AdminPinPageButton } from "@/components/admin/admin-pin-page-button";
import { AdminSaleHeaderActions } from "@/components/admin/admin-sale-header-actions";
import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import {
  CatalogBreadcrumbs,
  CatalogDetailMobileMeta,
  CatalogDetailShell,
  CatalogDetailStickyMiniBar,
  CatalogDetailTabNav,
} from "@/components/admin/catalog";
import { AdminSaleEditableTitle } from "@/components/admin/editable-titles";
import { SaleDetailMobileLifecycleTrailing } from "@/components/admin/sale-detail-mobile-lifecycle-trailing";
import { SaleContextRail } from "@/components/admin/sale-detail/sale-context-rail";
import { isSaleLiveish, venueOneLiner } from "@/components/admin/sale-detail/sale-detail-helpers";
import { saleDetailTabHref } from "@/components/admin/sale-detail/sale-detail-types";
import { buildSaleNavigationActionItems } from "@/lib/admin/build-sale-lifecycle-mobile-actions";
import type { AdminDomainEventRow, AdminSaleListRow } from "@/lib/data/http/admin.server";
import { salePath } from "@/lib/seo/url";
import { Badge } from "@auction/ui";
import type { ReactNode } from "react";

type Props = {
  saleId: string;
  bundle: AdminSaleListRow;
  registrationCount?: number | null;
  documentCount?: number | null;
  activityEvents?: readonly AdminDomainEventRow[];
  children: ReactNode;
};

export function SaleDetailShell({
  saleId,
  bundle,
  registrationCount = null,
  documentCount = null,
  activityEvents = [],
  children,
}: Props) {
  const { sale, lots } = bundle;
  const liveish = isSaleLiveish(sale);
  const venueLine = venueOneLiner(sale);
  const publicHref = salePath({ id: sale.id, title: sale.title });

  const canEdit = sale.status === "draft";
  const canPublish = sale.status === "draft";
  const canUnpublish = sale.status === "scheduled";
  const canCancel =
    sale.status === "draft" || sale.status === "scheduled" || sale.status === "active";
  const canDelete = bundle.deleteEligibility?.canDelete === true;
  const deleteBlockers =
    sale.status === "draft" || sale.status === "scheduled"
      ? (bundle.deleteEligibility?.blockers ?? [])
      : [];
  const isOnsite = sale.deliveryMode === "onsite";
  const canMarkOnsiteEnded = isOnsite && (sale.status === "active" || sale.status === "scheduled");

  const pendingRegs =
    liveish && registrationCount != null && registrationCount > 0 ? registrationCount : 0;

  const tabSpecs = [
    {
      id: "overview",
      label: "Overview",
      href: saleDetailTabHref(saleId, "overview"),
    },
    {
      id: "schedule",
      label: "Schedule",
      href: saleDetailTabHref(saleId, "schedule"),
    },
    {
      id: "lots",
      label: `Lots (${lots.length})`,
      href: saleDetailTabHref(saleId, "lots"),
      ...(sale.status === "draft" && lots.length === 0 ? { badge: "warning" as const } : {}),
    },
    {
      id: "documents",
      label: `Documents (${documentCount ?? 0})`,
      href: saleDetailTabHref(saleId, "documents"),
    },
    {
      id: "registrations",
      label: liveish ? `Registrations (${registrationCount ?? 0})` : "Registrations",
      href: saleDetailTabHref(saleId, "registrations"),
      ...(pendingRegs > 0 ? { badge: "pending" as const } : {}),
    },
    {
      id: "activity",
      label: "Activity",
      href: saleDetailTabHref(saleId, "activity"),
    },
  ];

  const mobileActions = buildSaleNavigationActionItems({
    saleId,
    publicHref,
    canEdit,
    liveish,
  });

  return (
    <CatalogDetailShell
      breadcrumbs={
        <CatalogBreadcrumbs
          segments={[{ label: "Sales", href: "/admin/sales" }, { label: sale.title }]}
        />
      }
      eyebrow="Sale"
      title={<AdminSaleEditableTitle saleId={saleId} value={sale.title} />}
      {...(venueLine ? { description: venueLine } : {})}
      meta={
        <div className="flex flex-wrap items-center gap-2">
          <AdminStatusBadge domain="sale" status={sale.status} />
          <Badge variant="secondary" className="capitalize">
            {sale.deliveryMode}
          </Badge>
        </div>
      }
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <AdminPinPageButton label={sale.title} />
          <AdminSaleHeaderActions
            saleId={saleId}
            saleTitle={sale.title}
            canEdit={canEdit}
            canPublish={canPublish}
            canUnpublish={canUnpublish}
            canCancel={canCancel}
            canDelete={canDelete}
            canMarkOnsiteEnded={canMarkOnsiteEnded}
            showSaleroomLink={liveish}
          />
        </div>
      }
      mobileActions={mobileActions}
      mobileActionBarTrailing={
        <SaleDetailMobileLifecycleTrailing
          saleId={saleId}
          saleTitle={sale.title}
          canPublish={canPublish}
          canUnpublish={canUnpublish}
          canCancel={canCancel}
          canDelete={canDelete}
          canMarkOnsiteEnded={canMarkOnsiteEnded}
        />
      }
      mobileMeta={
        <CatalogDetailMobileMeta
          entityId={saleId}
          updatedAt={sale.updatedAt}
          publicHref={publicHref}
          publicLabel="View on site"
          status={<AdminStatusBadge domain="sale" status={sale.status} />}
          quickLinks={[
            ...(liveish ? [{ label: "Open saleroom", href: `/admin/saleroom/${saleId}` }] : []),
          ]}
          primaryAction={
            liveish ? (
              <a
                href={`/admin/saleroom/${saleId}`}
                className="font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-primary hover:underline"
              >
                Open saleroom →
              </a>
            ) : canEdit ? (
              <a
                href={`/admin/sales/${saleId}/edit`}
                className="font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-primary hover:underline"
              >
                Edit draft →
              </a>
            ) : undefined
          }
        />
      }
      aside={
        <SaleContextRail
          saleId={saleId}
          sale={sale}
          lots={lots}
          liveish={liveish}
          registrationCount={registrationCount}
          activityEvents={activityEvents}
          deleteBlockers={deleteBlockers}
          status={<AdminStatusBadge domain="sale" status={sale.status} />}
          publicHref={publicHref}
        />
      }
      stickySubnav={
        <>
          <CatalogDetailTabNav
            tabs={tabSpecs}
            entityKind="sale"
            entityId={saleId}
            aria-label="Sale sections"
          />
          <CatalogDetailStickyMiniBar
            items={[
              { id: "lots", label: "Lots", value: lots.length },
              {
                id: "registrations",
                label: "Registrations",
                value: liveish ? (registrationCount ?? 0) : "—",
              },
            ]}
          />
        </>
      }
    >
      {children}
    </CatalogDetailShell>
  );
}
