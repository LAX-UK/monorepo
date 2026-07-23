import { AdminPinPageButton } from "@/components/admin/admin-pin-page-button";
import { AdminSaleHeaderActions } from "@/components/admin/admin-sale-header-actions";
import {
  CatalogBreadcrumbs,
  CatalogDetailMobileMeta,
  CatalogDetailShell,
  CatalogDetailTabNav,
} from "@/components/admin/catalog";
import { CatalogPostCreateSessionRoot } from "@/components/admin/catalog/catalog-post-create-session";
import { CatalogWhatsNextBanner } from "@/components/admin/catalog/catalog-whats-next-banner";
import { AdminSaleEditableTitle } from "@/components/admin/editable-titles";
import { AdminQrCodeButton } from "@/components/admin/qr-code/admin-qr-code-button";
import { SaleDetailMobileLifecycleTrailing } from "@/components/admin/sale-detail-mobile-lifecycle-trailing";
import { SaleDetailConnectNotice } from "@/components/admin/sale-detail/sale-detail-connect-notice";
import { isSaleLiveish, venueOneLiner } from "@/components/admin/sale-detail/sale-detail-helpers";
import { SaleDetailMetaRow } from "@/components/admin/sale-detail/sale-detail-meta-row";
import { SaleDetailReadinessProvider } from "@/components/admin/sale-detail/sale-detail-readiness-context";
import { SaleSetupProgressChip } from "@/components/admin/sale-detail/sale-setup-progress-chip";
import { SaleDeliveryPill, SaleStatusPill } from "@/components/admin/sale-detail/sale-status-pill";
import {
  buildSaleDetailNavActions,
  saleNavItemsToMobileBar,
} from "@/lib/admin/build-sale-lifecycle-mobile-actions";
import type { CatalogReadinessResult } from "@/lib/admin/catalog-readiness";
import { adminSaleroomHref } from "@/lib/admin/catalog-route-helpers";
import {
  computeSaleDetailReadiness,
  saleDetailCanPublish,
  saleDetailReadinessDismissKey,
} from "@/lib/admin/compute-sale-detail-readiness";
import type { ConnectRequiredByLotId } from "@/lib/admin/connect-readiness";
import { saleSetupResumeHref } from "@/lib/admin/sale-setup";
import { buildSaleDetailTabSpecs } from "@/lib/admin/sales/build-sale-detail-tab-specs";
import type { AdminSaleListRow } from "@/lib/data/http/admin.server";
import { salePath } from "@/lib/seo/url";
import { Button } from "@auction/ui/components/button";
import { isSaleroomDeliveryMode } from "@auction/validators";
import Link from "next/link";
import type { ReactNode } from "react";
import { Suspense } from "react";

type Props = {
  saleId: string;
  bundle: AdminSaleListRow;
  registrationCount?: number | null;
  pendingRegistrationCount?: number | null;
  pendingTelephoneBookingCount?: number | null;
  documentCount?: number | null;
  canManageSales?: boolean;
  connectRequiredByLotId?: ConnectRequiredByLotId;
  /** Precomputed in layout — avoids duplicate readiness work in rail and overview. */
  draftSetupReadiness?: CatalogReadinessResult | null;
  /** Merged API + local attention count for overview tab badge. */
  overviewAttentionCount?: number;
  linkedEventSlug?: string | null;
  linkedEventTitle?: string | null;
  children: ReactNode;
};

export function SaleDetailShell({
  saleId,
  bundle,
  registrationCount = null,
  pendingRegistrationCount = null,
  pendingTelephoneBookingCount = null,
  documentCount = null,
  canManageSales = false,
  connectRequiredByLotId,
  draftSetupReadiness: draftSetupReadinessProp,
  overviewAttentionCount = 0,
  linkedEventSlug = null,
  linkedEventTitle = null,
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
  const isSaleroom = isSaleroomDeliveryMode(sale.deliveryMode);
  const canMarkOnsiteEnded =
    canManageSales && isSaleroom && (sale.status === "active" || sale.status === "scheduled");

  const pendingRegs =
    liveish && pendingRegistrationCount != null && pendingRegistrationCount > 0
      ? pendingRegistrationCount
      : 0;

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

  const tabSpecs = buildSaleDetailTabSpecs({
    saleId,
    deliveryMode: sale.deliveryMode,
    liveish,
    lotCount: lots.length,
    saleStatus: sale.status,
    registrationCount,
    pendingRegistrationCount: pendingRegs,
    pendingTelephoneBookingCount: pendingTelephoneBookingCount ?? 0,
    documentCount,
    overviewAttentionCount,
  });

  const draftSetupHref =
    sale.status === "draft"
      ? saleSetupResumeHref(saleId, {
          sale,
          lots,
          pendingRegistrationCount,
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
            segments={[
              { label: "Admin", href: "/admin" },
              { label: "Sales", href: "/admin/sales" },
              { label: sale.title },
            ]}
          />
        }
        metaBelowTitle
        title={
          <AdminSaleEditableTitle saleId={saleId} value={sale.title} editable={canManageSales} />
        }
        meta={
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <SaleStatusPill status={sale.status} />
              <SaleDeliveryPill deliveryMode={sale.deliveryMode} />
              {sale.status === "draft" && setupReadiness && draftSetupHref ? (
                <SaleSetupProgressChip readiness={setupReadiness} setupHref={draftSetupHref} />
              ) : null}
            </div>
            <SaleDetailMetaRow
              sale={sale}
              venueLine={venueLine}
              lotCount={lots.length}
              registrationCount={registrationCount}
            />
          </div>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <AdminPinPageButton label={sale.title} />
            {canManageSales ? (
              <AdminQrCodeButton entityType="sale" entityId={saleId} title={sale.title} />
            ) : null}
            {liveish ? (
              <Button
                size="sm"
                className="bg-secondary text-on-secondary shadow-sm hover:bg-secondary/90"
                asChild
              >
                <Link href={adminSaleroomHref(saleId)}>+ Open sales room</Link>
              </Button>
            ) : null}
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
              hideSaleroomLink
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
            status={<SaleStatusPill status={sale.status} />}
            quickLinks={[
              ...(liveish ? [{ label: "Open saleroom", href: `/admin/saleroom/${saleId}` }] : []),
              ...(linkedEventSlug
                ? [
                    {
                      label: linkedEventTitle ?? "Linked RSVP event",
                      href: `/admin/event-rsvps/${encodeURIComponent(linkedEventSlug)}`,
                    },
                  ]
                : []),
            ]}
            primaryAction={
              saleNav.primaryMetaAction ? (
                <a
                  href={saleNav.primaryMetaAction.href}
                  className="font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-link hover:underline"
                >
                  {saleNav.primaryMetaAction.label}
                </a>
              ) : undefined
            }
          />
        }
        stickySubnav={
          <CatalogDetailTabNav tabs={tabSpecs} entityKind="sale" aria-label="Sale sections" />
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
        <SaleDetailReadinessProvider
          draftSetupReadiness={setupReadiness}
          deleteBlockers={deleteBlockers}
          canManageSales={canManageSales}
        >
          {children}
        </SaleDetailReadinessProvider>
      </CatalogDetailShell>
    </CatalogPostCreateSessionRoot>
  );
}
