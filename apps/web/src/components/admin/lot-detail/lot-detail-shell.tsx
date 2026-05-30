import { AdminLotDetailActions } from "@/components/admin/admin-lot-detail-actions";
import { AdminPinPageButton } from "@/components/admin/admin-pin-page-button";
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
import { QuickActionsRail } from "@/components/admin/detail-rail";
import { AdminLotEditableTitle } from "@/components/admin/editable-titles";
import { ReturnToInventoryButton } from "@/components/admin/lot-actions/return-to-inventory-button";
import { LotDetailMobilePublishCancel } from "@/components/admin/lot-detail-mobile-publish-cancel";
import { LotDetailQueueNav } from "@/components/admin/lot-detail-queue-nav";
import { LotContextRail } from "@/components/admin/lot-detail/lot-context-rail";
import { LotDetailConnectNotice } from "@/components/admin/lot-detail/lot-detail-connect-notice";
import { LotDetailReadinessProvider } from "@/components/admin/lot-detail/lot-detail-readiness-context";
import { lotDetailTabHref } from "@/components/admin/lot-detail/lot-detail-types";
import { LotStatusJourney } from "@/components/admin/lot-detail/lot-status-journey";
import { buildLotDetailNavActions } from "@/lib/admin/build-lot-mobile-actions";
import type { CatalogReadinessResult } from "@/lib/admin/catalog-readiness";
import {
  computeLotDetailReadiness,
  lotDetailReadinessDismissKey,
} from "@/lib/admin/compute-lot-detail-readiness";
import type { AdminLotDetailBundle } from "@/lib/admin/load-lot-detail";
import type { AdminDomainEventRow, AdminLotLifecyclePayload } from "@/lib/data/http/admin.server";
import { lotPath } from "@/lib/seo/url";
import { formatMoney } from "@/lib/ui/format";
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
  activityEvents = [],
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
      label: `Images (${auction.images.length})`,
      href: lotDetailTabHref(lotId, "images"),
      ...(catalogIncomplete && auction.images.length === 0 ? { badge: "warning" as const } : {}),
    },
    {
      id: "documents",
      label: `Documents (${documentCount ?? 0})`,
      href: lotDetailTabHref(lotId, "documents"),
    },
    {
      id: "bids",
      label: `Bids (${bidCount ?? 0})`,
      href: lotDetailTabHref(lotId, "bids"),
    },
    {
      id: "activity",
      label: "Activity",
      href: lotDetailTabHref(lotId, "activity"),
    },
  ];

  const quickActions = <QuickActionsRail actions={lotNav.quickRailItems} />;

  return (
    <CatalogPostCreateSessionRoot>
      <CatalogDetailShell
        breadcrumbs={
          <CatalogBreadcrumbs
            segments={[
              { label: "Lots", href: "/admin/lots" },
              ...(context.sale
                ? [{ label: context.sale.title, href: `/admin/sales/${context.sale.id}` }]
                : [{ label: "Unassigned" }]),
              ...(auction.lotNumber != null ? [{ label: `Lot #${auction.lotNumber}` }] : []),
            ]}
          />
        }
        eyebrow="Catalogue lot"
        title={<AdminLotEditableTitle lotId={lotId} value={auction.title} />}
        {...(subtitle ? { description: subtitle } : {})}
        meta={
          <div className="flex flex-wrap items-center gap-2">
            <AdminStatusBadge domain="lot" status={auction.status} />
            {auction.lotNumber != null ? (
              <Badge variant="secondary">Lot #{auction.lotNumber}</Badge>
            ) : null}
          </div>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <AdminPinPageButton label={auction.title} />
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
              publicHref={publicHref}
              sellerLegalEntityId={auction.sellerLegalEntityId ?? null}
              canPublish={canPublish}
              connectBlocked={connectRequired}
              saleStatus={context.sale?.status ?? null}
              publishReadiness={publishReadiness}
              canCancel={canCancel}
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
            sellerLegalEntityId={auction.sellerLegalEntityId ?? null}
            canPublish={canPublish}
            connectBlocked={connectRequired}
            saleStatus={context.sale?.status ?? null}
            publishReadiness={publishReadiness}
            canCancel={canCancel}
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
                  className="font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-primary hover:underline"
                >
                  {lotNav.primaryMetaAction.label}
                </a>
              ) : undefined
            }
          />
        }
        aside={
          <LotContextRail
            lotId={lotId}
            auction={auction}
            context={context}
            bidCount={bidCount}
            activityEvents={activityEvents}
            publishReadiness={publishReadiness}
            status={<AdminStatusBadge domain="lot" status={auction.status} />}
            publicHref={publicHref}
            quickActions={quickActions}
          />
        }
        stickySubnav={
          <>
            <CatalogDetailTabNav
              tabs={tabSpecs}
              entityKind="lot"
              entityId={lotId}
              aria-label="Lot sections"
            />
            <LotDetailQueueNav
              lotId={lotId}
              saleId={auction.saleId ?? null}
              lotNumber={auction.lotNumber ?? null}
              compact
            />
            <CatalogDetailStickyMiniBar
              items={[
                { id: "hammer", label: "Hammer", value: formatMoney(auction.currentPrice) },
                {
                  id: "status",
                  label: "Status",
                  value: <AdminStatusBadge domain="lot" status={auction.status} />,
                },
              ]}
            />
          </>
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
        <LotDetailReadinessProvider publishReadiness={publishReadiness}>
          {children}
        </LotDetailReadinessProvider>
      </CatalogDetailShell>
    </CatalogPostCreateSessionRoot>
  );
}
