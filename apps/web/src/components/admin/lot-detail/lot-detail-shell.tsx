import { AdminLotDetailActions } from "@/components/admin/admin-lot-detail-actions";
import { AdminLotDetailKpiStrip } from "@/components/admin/admin-lot-detail-kpi-strip";
import { AdminPinPageButton } from "@/components/admin/admin-pin-page-button";
import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import {
  CatalogBreadcrumbs,
  CatalogDetailMobileMeta,
  CatalogDetailShell,
  CatalogDetailTabNav,
  CatalogInfoAside,
  type CatalogMobileAction,
} from "@/components/admin/catalog";
import { AdminLotEditableTitle } from "@/components/admin/editable-titles";
import { LotDetailMobilePublishCancel } from "@/components/admin/lot-detail-mobile-publish-cancel";
import { LotDetailQueueNav } from "@/components/admin/lot-detail-queue-nav";
import { LotDetailAsideLinks } from "@/components/admin/lot-detail/lot-detail-aside-links";
import {
  lotDetailTabHref,
  parseLotDetailTabFromPath,
} from "@/components/admin/lot-detail/lot-detail-types";
import { clampCatalogDescription } from "@/lib/admin/catalog-detail-description";
import type { AdminLotDetailBundle } from "@/lib/admin/load-lot-detail";
import { lotPath } from "@/lib/seo/url";
import { Badge } from "@auction/ui";
import type { ReactNode } from "react";

type Props = {
  lotId: string;
  bundle: AdminLotDetailBundle;
  bidCount?: number | null;
  children: ReactNode;
};

export function LotDetailShell({ lotId, bundle, bidCount = null, children }: Props) {
  const { auction, context } = bundle;
  const publicHref = lotPath({ id: auction.id, title: auction.title });

  const canPublish = auction.status === "draft";
  const canCancel =
    auction.status === "draft" || auction.status === "scheduled" || auction.status === "active";
  const canEditDraft = auction.status === "draft";
  const canEditLot = auction.status === "scheduled";
  const showEditCatalog = auction.status === "active";

  const mobileActions: CatalogMobileAction[] = [];
  if (canEditDraft) {
    mobileActions.push({
      id: "edit-draft",
      label: "Edit draft",
      href: `/admin/lots/${lotId}/edit`,
      variant: "primary",
    });
  } else if (canEditLot) {
    mobileActions.push({
      id: "edit-lot",
      label: "Edit lot",
      href: `/admin/lots/${lotId}/edit`,
      variant: "primary",
    });
  } else if (showEditCatalog) {
    mobileActions.push({
      id: "edit-catalog",
      label: "Edit catalog copy",
      href: `/admin/lots/${lotId}/edit/catalog`,
      variant: "primary",
    });
  }
  mobileActions.push({
    id: "duplicate",
    label: "Duplicate draft",
    href: `/admin/lots/new?fromLot=${encodeURIComponent(lotId)}`,
  });
  mobileActions.push({
    id: "site",
    label: "View on site",
    href: publicHref,
  });

  const tabSpecs = [
    { id: "overview", label: "Overview", href: lotDetailTabHref(lotId, "overview") },
    {
      id: "images",
      label: `Images${auction.images.length > 0 ? ` (${auction.images.length})` : ""}`,
      href: lotDetailTabHref(lotId, "images"),
    },
    { id: "documents", label: "Documents", href: lotDetailTabHref(lotId, "documents") },
    {
      id: "bids",
      label: `Bids${bidCount != null && bidCount > 0 ? ` (${bidCount})` : ""}`,
      href: lotDetailTabHref(lotId, "bids"),
    },
  ];

  return (
    <CatalogDetailShell
      breadcrumbs={
        <div className="space-y-3">
          <CatalogBreadcrumbs
            segments={[
              { label: "Lots", href: "/admin/lots" },
              ...(context.sale
                ? [{ label: context.sale.title, href: `/admin/sales/${context.sale.id}` }]
                : [{ label: "Unassigned" }]),
              ...(auction.lotNumber != null ? [{ label: `Lot #${auction.lotNumber}` }] : []),
            ]}
          />
          <LotDetailQueueNav
            lotId={lotId}
            saleId={auction.saleId ?? null}
            lotNumber={auction.lotNumber ?? null}
          />
        </div>
      }
      eyebrow="Catalogue lot"
      title={<AdminLotEditableTitle lotId={lotId} value={auction.title} />}
      description={clampCatalogDescription(auction.description)}
      meta={
        <div className="flex flex-wrap items-center gap-2">
          <AdminStatusBadge domain="lot" status={auction.status} />
          {auction.lotNumber != null ? (
            <Badge variant="secondary">Lot #{auction.lotNumber}</Badge>
          ) : null}
          <Badge variant="outline" className="capitalize">
            {auction.auctionType.replace(/_/g, " ")}
          </Badge>
        </div>
      }
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <AdminPinPageButton label={auction.title} />
          <AdminLotDetailActions
            key={lotId}
            lotId={lotId}
            publicHref={publicHref}
            sellerLegalEntityId={auction.sellerLegalEntityId ?? null}
            canPublish={canPublish}
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
        >
          <LotDetailAsideLinks context={context} />
        </CatalogDetailMobileMeta>
      }
      aside={
        <CatalogInfoAside
          entityId={lotId}
          {...(auction.updatedAt ? { updatedAt: auction.updatedAt } : {})}
          publicHref={publicHref}
          publicLabel="View on site"
          status={<AdminStatusBadge domain="lot" status={auction.status} />}
        >
          <LotDetailAsideLinks context={context} />
        </CatalogInfoAside>
      }
      tabs={
        <div className="space-y-6">
          <AdminLotDetailKpiStrip lotId={lotId} auction={auction} bidCount={bidCount} />
          <CatalogDetailTabNav
            tabs={tabSpecs}
            resolveActiveTab={(pathname) => parseLotDetailTabFromPath(pathname, lotId)}
            aria-label="Lot sections"
          />
          <div>{children}</div>
        </div>
      }
    >
      {null}
    </CatalogDetailShell>
  );
}
