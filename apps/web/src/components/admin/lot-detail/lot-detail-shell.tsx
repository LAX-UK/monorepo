import { AdminLotDetailActions } from "@/components/admin/admin-lot-detail-actions";
import { AdminPinPageButton } from "@/components/admin/admin-pin-page-button";
import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import {
  CatalogBreadcrumbs,
  CatalogDetailMobileMeta,
  CatalogDetailShell,
  CatalogDetailTabNav,
} from "@/components/admin/catalog";
import { CatalogPostCreateSessionRoot } from "@/components/admin/catalog/catalog-post-create-session";
import { CatalogWhatsNextBanner } from "@/components/admin/catalog/catalog-whats-next-banner";
import { AdminLotEditableTitle } from "@/components/admin/editable-titles";
import { ReturnToInventoryButton } from "@/components/admin/lot-actions/return-to-inventory-button";
import { LotDetailMobilePublishCancel } from "@/components/admin/lot-detail-mobile-publish-cancel";
import { LotDetailQueueNav } from "@/components/admin/lot-detail-queue-nav";
import { LotDetailConnectNotice } from "@/components/admin/lot-detail/lot-detail-connect-notice";
import { LotDetailMetaRow } from "@/components/admin/lot-detail/lot-detail-meta-row";
import { LotDetailReadinessProvider } from "@/components/admin/lot-detail/lot-detail-readiness-context";
import { lotDetailTabHref } from "@/components/admin/lot-detail/lot-detail-types";
import { LotStatusJourney } from "@/components/admin/lot-detail/lot-status-journey";
import { AdminQrCodeButton } from "@/components/admin/qr-code/admin-qr-code-button";
import { buildLotDetailNavActions } from "@/lib/admin/build-lot-mobile-actions";
import type { CatalogReadinessResult } from "@/lib/admin/catalog-readiness";
import {
  computeLotDetailReadiness,
  lotDetailReadinessDismissKey,
} from "@/lib/admin/compute-lot-detail-readiness";
import type { AdminLotDetailBundle } from "@/lib/admin/load-lot-detail";
import type { AdminDomainEventRow, AdminLotLifecyclePayload } from "@/lib/data/http/admin.server";
import { lotPath } from "@/lib/seo/url";
import { Badge } from "@auction/ui";
import type { ReactNode } from "react";
import { Suspense } from "react";

type Props = {
  lotId: string;
  bundle: AdminLotDetailBundle;
  bidCount?: number | null;
  documentCount?: number | null;
  activityEvents?: readonly AdminDomainEventRow[];
  lifecycle?: AdminLotLifecyclePayload;
  connectRequired?: boolean;
  canManageCatalog?: boolean;
  canManageAuction?: boolean;
  publishReadiness?: CatalogReadinessResult | null;
  children: ReactNode;
};

function lotSubtitle(auction: AdminLotDetailBundle["auction"]): string | undefined {
  if (auction.medium?.trim()) return auction.medium.trim();
  if (auction.lotNumber != null) return `Lot #${auction.lotNumber}`;
  return undefined;
}

export function LotDetailShell({
  lotId,
  bundle,
  bidCount = null,
  documentCount = null,
  activityEvents: _activityEvents = [],
  lifecycle = { snapshot: null, events: [] },
  connectRequired = false,
  canManageCatalog = false,
  canManageAuction = false,
  publishReadiness: publishReadinessProp,
  children,
}: Props) {
  const { auction, context } = bundle;
  const publicHref = lotPath({ id: auction.id, title: auction.title });
  const subtitle = lotSubtitle(auction);

  const canPublish = auction.status === "draft" && canManageCatalog;
  const canCancel =
    canManageAuction &&
    (auction.status === "draft" || auction.status === "scheduled" || auction.status === "active");
  const canEditDraft = auction.status === "draft";
  const canEditLot = auction.status === "scheduled";
  const showEditCatalog = auction.status === "active";
  const canEditTitle =
    canManageCatalog &&
    (auction.status === "draft" || auction.status === "scheduled" || auction.status === "active");
  const canDelete = canManageAuction && bundle.deleteEligibility?.canDelete === true;
  const deleteBlockers =
    auction.status === "draft" || auction.status === "scheduled"
      ? (bundle.deleteEligibility?.blockers ?? [])
      : [];
  const parentSaleForDelete =
    context.sale && context.parentSaleLotCount != null
      ? {
          id: context.sale.id,
          title: context.sale.title,
          status: context.sale.status,
          lotCount: context.parentSaleLotCount,
        }
      : null;

  const lotNav = buildLotDetailNavActions({
    lotId,
    publicHref,
    canEditDraft,
    canEditLot,
    showEditCatalog,
  });
  const mobileActions = lotNav.barActions;

  const catalogIncomplete =
    auction.status === "draft" && (auction.images.length === 0 || !auction.description?.trim());

  const publishReadiness =
    publishReadinessProp !== undefined
      ? publishReadinessProp
      : computeLotDetailReadiness({
          lotId,
          auction,
          context,
          connectRequired,
        });

  const tabSpecs = [
    {
      id: "overview",
      label: "Overview",
      href: lotDetailTabHref(lotId, "overview"),
    },
    {
      id: "images",
      label: `Media (${auction.images.length})`,
      href: lotDetailTabHref(lotId, "images"),
      ...(catalogIncomplete ? { badge: "warning" as const } : {}),
    },
    {
      id: "documents",
      label: `Documents (${documentCount ?? 0})`,
      href: lotDetailTabHref(lotId, "documents"),
    },
    {
      id: "bids",
      label: `Bidding (${bidCount ?? 0})`,
      href: lotDetailTabHref(lotId, "bids"),
    },
    {
      id: "activity",
      label: "Activity",
      href: lotDetailTabHref(lotId, "activity"),
    },
  ];

  return (
    <CatalogPostCreateSessionRoot>
      <CatalogDetailShell
        breadcrumbs={
          <CatalogBreadcrumbs
            segments={[
              { label: "Admin", href: "/admin" },
              { label: "Lots", href: "/admin/lots" },
              ...(context.sale
                ? [{ label: context.sale.title, href: `/admin/sales/${context.sale.id}` }]
                : []),
              { label: auction.title },
            ]}
          />
        }
        contextNav={
          context.sale ? (
            <LotDetailQueueNav
              lotId={lotId}
              saleId={auction.saleId ?? null}
              saleTitle={context.sale.title}
              lotNumber={auction.lotNumber ?? null}
            />
          ) : null
        }
        metaBelowTitle
        eyebrow={context.artist?.displayName ?? "Catalogue lot"}
        title={
          <AdminLotEditableTitle lotId={lotId} value={auction.title} editable={canEditTitle} />
        }
        {...(subtitle ? { description: subtitle } : {})}
        meta={
          <div className="space-y-3">
            <LotDetailMetaRow
              auction={auction}
              context={context}
              bidCount={bidCount}
              {...(auction.updatedAt ? { updatedAt: auction.updatedAt } : {})}
            />
            <div className="flex flex-wrap items-center gap-2">
              <AdminStatusBadge domain="lot" status={auction.status} />
              {auction.lotNumber != null ? (
                <Badge variant="secondary">Lot #{auction.lotNumber}</Badge>
              ) : null}
            </div>
          </div>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <AdminPinPageButton label={auction.title} />
            {canManageCatalog ? (
              <AdminQrCodeButton entityType="lot" entityId={lotId} title={auction.title} />
            ) : null}
            {canManageAuction ? (
              <ReturnToInventoryButton
                lotId={lotId}
                status={auction.status}
                hasWinner={Boolean(auction.winnerId)}
              />
            ) : null}
            <AdminLotDetailActions
              key={lotId}
              lotId={lotId}
              lotTitle={auction.title}
              publicHref={publicHref}
              sellerLegalEntityId={auction.sellerLegalEntityId ?? null}
              canPublish={canPublish}
              connectBlocked={connectRequired}
              saleStatus={context.sale?.status ?? null}
              publishReadiness={publishReadiness}
              canCancel={canCancel}
              canDelete={canDelete}
              parentSale={parentSaleForDelete}
              showEditDraft={canEditDraft}
              showEditLot={canEditLot}
              showEditCatalog={showEditCatalog}
            />
          </div>
        }
        mobileActions={mobileActions}
        mobileActionBarTrailing={
          <LotDetailMobilePublishCancel
            lotId={lotId}
            lotTitle={auction.title}
            sellerLegalEntityId={auction.sellerLegalEntityId ?? null}
            canPublish={canPublish}
            connectBlocked={connectRequired}
            saleStatus={context.sale?.status ?? null}
            publishReadiness={publishReadiness}
            canCancel={canCancel}
            canDelete={canDelete}
            parentSale={parentSaleForDelete}
          />
        }
        mobileMeta={
          <CatalogDetailMobileMeta
            entityId={lotId}
            {...(auction.updatedAt ? { updatedAt: auction.updatedAt } : {})}
            publicHref={publicHref}
            publicLabel="View on site"
            status={<AdminStatusBadge domain="lot" status={auction.status} />}
            quickLinks={[
              ...(context.sale
                ? [{ label: context.sale.title, href: `/admin/sales/${context.sale.id}` }]
                : []),
            ]}
            primaryAction={
              lotNav.primaryMetaAction ? (
                <a
                  href={lotNav.primaryMetaAction.href}
                  className="font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-link hover:underline"
                >
                  {lotNav.primaryMetaAction.label}
                </a>
              ) : undefined
            }
          />
        }
        aside={undefined}
        stickySubnav={
          <CatalogDetailTabNav tabs={tabSpecs} entityKind="lot" aria-label="Lot sections" />
        }
      >
        <LotStatusJourney
          snapshot={lifecycle.snapshot}
          events={lifecycle.events}
          saleName={context.sale?.title ?? null}
        />
        <Suspense fallback={null}>
          <LotDetailConnectNotice
            proactiveConnectRequired={connectRequired}
            sellerLegalEntityId={auction.sellerLegalEntityId ?? null}
          />
        </Suspense>
        {publishReadiness ? (
          <Suspense fallback={null}>
            <CatalogWhatsNextBanner
              entityLabel="lot"
              readiness={publishReadiness}
              dismissKey={lotDetailReadinessDismissKey(lotId)}
            />
          </Suspense>
        ) : null}
        <LotDetailReadinessProvider
          publishReadiness={publishReadiness}
          deleteBlockers={deleteBlockers}
          canManageAuction={canManageAuction}
        >
          {children}
        </LotDetailReadinessProvider>
      </CatalogDetailShell>
    </CatalogPostCreateSessionRoot>
  );
}
