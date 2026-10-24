import { AdminLotDetailActions } from "@/components/admin/admin-lot-detail-actions";
import { CatalogPostCreateSessionRoot } from "@/components/admin/catalog/catalog-post-create-session";
import { CatalogWhatsNextBanner } from "@/components/admin/catalog/catalog-whats-next-banner";
import { LotDetailConnectNotice } from "@/components/admin/lot-detail/lot-detail-connect-notice";
import { LotDetailReadinessProvider } from "@/components/admin/lot-detail/lot-detail-readiness-context";
import { lotDetailTabHref } from "@/components/admin/lot-detail/lot-detail-types";
import { LotStatusJourney } from "@/components/admin/lot-detail/lot-status-journey";
import { StaffDetailTabs } from "@/components/admin/staff/staff-detail-tabs";
import { StaffEditableTitle } from "@/components/admin/staff/staff-editable-title";
import { adminUpdateLotTitleFieldAction } from "@/lib/actions/admin/field-updates";
import type { CatalogReadinessResult } from "@/lib/admin/catalog-readiness";
import {
  computeLotDetailReadiness,
  lotDetailReadinessDismissKey,
} from "@/lib/admin/compute-lot-detail-readiness";
import type { AdminLotDetailBundle } from "@/lib/admin/load-lot-detail";
import { toStaffStatus } from "@/lib/admin/staff-kit-status";
import type { AdminDomainEventRow, AdminLotLifecyclePayload } from "@/lib/data/http/admin.server";
import { lotAuctionTypeLabel } from "@/lib/presenters/lot-auction-type/lot-auction-type-registry";
import { lotStatusLabel, lotStatusToBadgeVariant } from "@/lib/presenters/status-presentation";
import { lotPath } from "@/lib/seo/url";
import {
  MetaItem,
  PageHeader,
  StaffBreadcrumbs,
  type StaffLinkComponent,
  StatusBadge,
} from "@auction/staff-ui";
import Link from "next/link";
import type { ReactNode } from "react";
import { Suspense } from "react";

const NextLink: StaffLinkComponent = Link;

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

/**
 * A lot's page frame in the staff kit: where it sits (breadcrumbs), what it is (title, status,
 * key facts), what can be done next (actions this role may take) and its sections as tabs. The
 * section content renders below, inside the readiness context the tabs share.
 */
export function LotDetailShell({
  lotId,
  bundle,
  bidCount = null,
  documentCount = null,
  lifecycle = { snapshot: null, events: [] },
  connectRequired = false,
  canManageCatalog = false,
  canManageAuction = false,
  publishReadiness: publishReadinessProp,
  children,
}: Props) {
  const { auction, context } = bundle;
  const publicHref = lotPath({ id: auction.id, title: auction.title });
  const status = toStaffStatus(
    lotStatusToBadgeVariant(auction.status),
    lotStatusLabel[auction.status] ?? auction.status,
  );

  const canPublish = auction.status === "draft" && canManageCatalog;
  const canCancel =
    canManageAuction &&
    (auction.status === "draft" || auction.status === "scheduled" || auction.status === "active");
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
  const catalogIncomplete =
    auction.status === "draft" && (auction.images.length === 0 || !auction.description?.trim());

  const publishReadiness =
    publishReadinessProp !== undefined
      ? publishReadinessProp
      : computeLotDetailReadiness({ lotId, auction, context, connectRequired });

  return (
    <CatalogPostCreateSessionRoot>
      <div className="flex flex-col gap-6">
        <PageHeader
          breadcrumbs={
            <StaffBreadcrumbs
              Link={NextLink}
              items={[
                { label: "Lots", href: "/admin/lots" },
                ...(context.sale
                  ? [{ label: context.sale.title, href: `/admin/sales/${context.sale.id}` }]
                  : []),
                { label: auction.title },
              ]}
            />
          }
          title={
            <StaffEditableTitle
              value={auction.title}
              label="lot"
              editable={canEditTitle}
              onSave={adminUpdateLotTitleFieldAction.bind(null, lotId)}
            />
          }
          status={
            <StatusBadge tone={status.tone} live={status.live ?? false}>
              {status.label}
            </StatusBadge>
          }
          meta={
            <>
              {auction.lotNumber != null ? (
                <MetaItem label="Lot">{auction.lotNumber}</MetaItem>
              ) : null}
              <MetaItem label="Type">{lotAuctionTypeLabel(auction.auctionType)}</MetaItem>
              {context.artist ? (
                <MetaItem label="Artist">
                  <Link href={`/admin/artists/${context.artist.id}`} className="hover:underline">
                    {context.artist.displayName}
                  </Link>
                </MetaItem>
              ) : null}
              {bidCount != null ? <MetaItem label="Bids">{bidCount}</MetaItem> : null}
            </>
          }
          primaryAction={
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
              showEditDraft={canManageCatalog && auction.status === "draft"}
              showEditLot={canManageCatalog && auction.status === "scheduled"}
              showEditCatalog={canManageCatalog && auction.status === "active"}
            />
          }
          tabs={
            <StaffDetailTabs
              label="Lot sections"
              items={[
                { id: "overview", label: "Overview", href: lotDetailTabHref(lotId, "overview") },
                {
                  id: "images",
                  label: catalogIncomplete ? "Media · needs work" : "Media",
                  href: lotDetailTabHref(lotId, "images"),
                  count: auction.images.length,
                },
                {
                  id: "documents",
                  label: "Documents",
                  href: lotDetailTabHref(lotId, "documents"),
                  count: documentCount ?? 0,
                },
                {
                  id: "bids",
                  label: "Bidding",
                  href: lotDetailTabHref(lotId, "bids"),
                  count: bidCount ?? 0,
                },
                { id: "activity", label: "Activity", href: lotDetailTabHref(lotId, "activity") },
              ]}
            />
          }
        />
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
      </div>
    </CatalogPostCreateSessionRoot>
  );
}
