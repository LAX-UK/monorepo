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
import { CatalogPostCreateSessionRoot } from "@/components/admin/catalog/catalog-post-create-session";
import { CatalogWhatsNextBanner } from "@/components/admin/catalog/catalog-whats-next-banner";
import { AdminSaleEditableTitle } from "@/components/admin/editable-titles";
import { SaleDetailMobileLifecycleTrailing } from "@/components/admin/sale-detail-mobile-lifecycle-trailing";
import { SaleContextRail } from "@/components/admin/sale-detail/sale-context-rail";
import { SaleDetailConnectNotice } from "@/components/admin/sale-detail/sale-detail-connect-notice";
import { isSaleLiveish, venueOneLiner } from "@/components/admin/sale-detail/sale-detail-helpers";
import { SaleDetailReadinessProvider } from "@/components/admin/sale-detail/sale-detail-readiness-context";
import { saleDetailTabHref } from "@/components/admin/sale-detail/sale-detail-types";
import { SaleSetupProgressChip } from "@/components/admin/sale-detail/sale-setup-progress-chip";
import {
  buildSaleDetailNavActions,
  saleNavItemsToMobileBar,
} from "@/lib/admin/build-sale-lifecycle-mobile-actions";
import type { CatalogReadinessResult } from "@/lib/admin/catalog-readiness";
import {
  computeSaleDetailReadiness,
  saleDetailCanPublish,
  saleDetailReadinessDismissKey,
} from "@/lib/admin/compute-sale-detail-readiness";
import type { ConnectRequiredByLotId } from "@/lib/admin/connect-readiness";
import { saleSetupResumeHref } from "@/lib/admin/sale-setup";
import type { AdminDomainEventRow, AdminSaleListRow } from "@/lib/data/http/admin.server";
import { salePath } from "@/lib/seo/url";
import { Badge } from "@auction/ui";
import type { ReactNode } from "react";
import { Suspense } from "react";

type Props = {
  saleId: string;
  bundle: AdminSaleListRow;
  registrationCount?: number | null;
  documentCount?: number | null;
  activityEvents?: readonly AdminDomainEventRow[];
  canManageSales?: boolean;
  connectRequiredByLotId?: ConnectRequiredByLotId;
  /** Precomputed in layout — avoids duplicate readiness work in rail and overview. */
  draftSetupReadiness?: CatalogReadinessResult | null;
  children: ReactNode;
};

export function SaleDetailShell({
  saleId,
  bundle,
  registrationCount = null,
  documentCount = null,
  activityEvents = [],
  canManageSales = false,
  connectRequiredByLotId,
  draftSetupReadiness: draftSetupReadinessProp,
  children,
}: Props) {
  const { sale, lots } = bundle;
  const liveish = isSaleLiveish(sale);
  const venueLine = venueOneLiner(sale);
  const publicHref = salePath({ id: sale.id, title: sale.title });

  const canEditDraftSale = sale.status === "draft" && canManageSales;
  const canPublish = sale.status === "draft" && canManageSales;
  const canUnpublish = sale.status === "scheduled" && canManageSales;
  const canCancel =
    canManageSales &&
    (sale.status === "draft" || sale.status === "scheduled" || sale.status === "active");
  const canDelete = canManageSales && bundle.deleteEligibility?.canDelete === true;
  const deleteBlockers =
    sale.status === "draft" || sale.status === "scheduled"
      ? (bundle.deleteEligibility?.blockers ?? [])
      : [];
  const isOnsite = sale.deliveryMode === "onsite";
  const canMarkOnsiteEnded =
    canManageSales && isOnsite && (sale.status === "active" || sale.status === "scheduled");

  const pendingRegs =
    liveish && registrationCount != null && registrationCount > 0 ? registrationCount : 0;

  const setupReadiness =
    draftSetupReadinessProp !== undefined
      ? draftSetupReadinessProp
      : computeSaleDetailReadiness({
          saleId,
          sale,
          lots,
          pendingRegistrationCount: pendingRegs > 0 ? pendingRegs : null,
          ...(connectRequiredByLotId ? { connectRequiredByLotId } : {}),
        });

  const publishReady = sale.status === "draft" && saleDetailCanPublish(setupReadiness);

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

  const draftSetupHref =
    sale.status === "draft"
      ? saleSetupResumeHref(saleId, {
          sale,
          lots,
          pendingRegistrationCount: registrationCount,
          ...(connectRequiredByLotId ? { connectRequiredByLotId } : {}),
        })
      : undefined;

  const saleNav = buildSaleDetailNavActions({
    saleId,
    publicHref,
    canEdit: canEditDraftSale,
    liveish,
    isDraft: sale.status === "draft",
    canManageSales,
    ...(sale.status === "draft" && !canEditDraftSale && draftSetupHref ? { draftSetupHref } : {}),
  });
  const mobileActions = saleNavItemsToMobileBar(saleNav.barActions);

  return (
    <CatalogPostCreateSessionRoot>
      <CatalogDetailShell
        breadcrumbs={
          <CatalogBreadcrumbs
            segments={[{ label: "Sales", href: "/admin/sales" }, { label: sale.title }]}
          />
        }
        eyebrow="Sale"
        title={
          <AdminSaleEditableTitle saleId={saleId} value={sale.title} editable={canManageSales} />
        }
        {...(venueLine ? { description: venueLine } : {})}
        meta={
          <div className="flex flex-wrap items-center gap-2">
            <AdminStatusBadge domain="sale" status={sale.status} />
            <Badge variant="secondary" className="capitalize">
              {sale.deliveryMode}
            </Badge>
            {sale.status === "draft" && setupReadiness && draftSetupHref ? (
              <SaleSetupProgressChip readiness={setupReadiness} setupHref={draftSetupHref} />
            ) : null}
          </div>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <AdminPinPageButton label={sale.title} />
            <AdminSaleHeaderActions
              saleId={saleId}
              saleTitle={sale.title}
              canEdit={canEditDraftSale}
              canPublish={canPublish}
              publishReady={publishReady}
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
            publishReady={publishReady}
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
              saleNav.primaryMetaAction ? (
                <a
                  href={saleNav.primaryMetaAction.href}
                  className="font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-primary hover:underline"
                >
                  {saleNav.primaryMetaAction.label}
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
            canManageSales={canManageSales}
            draftSetupReadiness={setupReadiness}
            quickRailItems={saleNav.quickRailItems}
            {...(connectRequiredByLotId ? { connectRequiredByLotId } : {})}
            {...(draftSetupHref ? { draftSetupHref } : {})}
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
        <Suspense fallback={null}>
          <SaleDetailConnectNotice
            lots={lots}
            {...(connectRequiredByLotId ? { connectRequiredByLotId } : {})}
          />
        </Suspense>
        {setupReadiness ? (
          <Suspense fallback={null}>
            <CatalogWhatsNextBanner
              entityLabel="sale"
              readiness={setupReadiness}
              dismissKey={saleDetailReadinessDismissKey(saleId)}
            />
          </Suspense>
        ) : null}
        <SaleDetailReadinessProvider draftSetupReadiness={setupReadiness}>
          {children}
        </SaleDetailReadinessProvider>
      </CatalogDetailShell>
    </CatalogPostCreateSessionRoot>
  );
}
