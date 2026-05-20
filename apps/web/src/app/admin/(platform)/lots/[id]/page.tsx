import { TabbedQueueSkeleton } from "@/components/admin/admin-loading-skeletons";
import { AdminLotBidsTable } from "@/components/admin/admin-lot-bids-table";
import { AdminLotConnectRequiredBanner } from "@/components/admin/admin-lot-connect-required-banner";
import { AdminLotDetailActions } from "@/components/admin/admin-lot-detail-actions";
import { AdminLotOverviewPanel } from "@/components/admin/admin-lot-overview-panel";
import { AdminPinPageButton } from "@/components/admin/admin-pin-page-button";
import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import {
  CatalogDetailShell,
  CatalogInfoAside,
  type CatalogMobileAction,
  CatalogTabPanel,
  type CatalogTabPanelItem,
} from "@/components/admin/catalog";
import { AdminLotEditableTitle } from "@/components/admin/editable-titles";
import { LotDetailMobilePublishCancel } from "@/components/admin/lot-detail-mobile-publish-cancel";
import { LotDetailQueueNav } from "@/components/admin/lot-detail-queue-nav";
import { LotDocumentsSection } from "@/components/admin/lot-form/lot-documents-section";
import { LotImageTab } from "@/components/admin/lot-image-tab";
import { getAdminLotById } from "@/lib/data/http/admin.server";
import { getServerLotDocuments } from "@/lib/data/http/lot-documents.server";
import { getServerLotBids } from "@/lib/data/http/lots.server";
import { lotPath } from "@/lib/seo/url";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

export default async function AdminLotDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; error_code?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;

  const [auction, lotDocuments, bids] = await Promise.all([
    getAdminLotById(id).catch(() => null),
    getServerLotDocuments(id).catch(() => []),
    getServerLotBids(id, 100).catch(() => []),
  ]);

  if (!auction) notFound();

  const canPublish = auction.status === "draft";
  const canCancel =
    auction.status === "draft" || auction.status === "scheduled" || auction.status === "active";

  const canEditDraft = auction.status === "draft";
  const showEditCatalog =
    auction.status === "draft" || auction.status === "scheduled" || auction.status === "active";

  const imageAlts = auction.marketingDetails.imageAlts ?? [];

  const publicHref = lotPath({ id: auction.id, title: auction.title });

  const mobileActions: CatalogMobileAction[] = [];
  if (canEditDraft) {
    mobileActions.push({
      id: "edit-draft",
      label: "Edit draft",
      href: `/admin/lots/${id}/edit`,
      variant: "primary",
    });
  } else if (showEditCatalog) {
    mobileActions.push({
      id: "edit-catalog",
      label: "Edit catalog copy",
      href: `/admin/lots/${id}/edit`,
      variant: "primary",
    });
  }
  mobileActions.push({
    id: "duplicate",
    label: "Duplicate draft",
    href: `/admin/lots/new?fromLot=${encodeURIComponent(id)}`,
    variant: mobileActions.some((a) => a.variant === "primary") ? "secondary" : "primary",
  });

  const tabItems: CatalogTabPanelItem[] = [
    {
      value: "overview",
      label: "Overview",
      content: (
        <AdminLotOverviewPanel
          auction={auction}
          imageAlts={imageAlts.filter(Boolean) as string[]}
        />
      ),
    },
    {
      value: "images",
      label: `Images${auction.images.length > 0 ? ` (${auction.images.length})` : ""}`,
      content: <LotImageTab lotId={id} initialImages={auction.images} initialAlts={imageAlts} />,
    },
    {
      value: "documents",
      label: `Documents${lotDocuments.length > 0 ? ` (${lotDocuments.length})` : ""}`,
      content: <LotDocumentsSection lotId={id} initialDocuments={lotDocuments} />,
    },
    {
      value: "bids",
      label: `Bids${bids.length > 0 ? ` (${bids.length})` : ""}`,
      content: <AdminLotBidsTable bids={bids} />,
    },
  ];

  return (
    <CatalogDetailShell
      breadcrumbs={
        <Link href="/admin/lots" className="text-primary hover:underline">
          ← Lots
        </Link>
      }
      eyebrow="Catalogue lot"
      title={<AdminLotEditableTitle lotId={id} value={auction.title} />}
      titleAddon={
        <div className="max-w-full shrink-0 md:max-w-[min(100%,31.5rem)]">
          <LotDetailQueueNav
            lotId={id}
            saleId={auction.saleId ?? null}
            lotNumber={auction.lotNumber ?? null}
          />
        </div>
      }
      description={auction.description ?? undefined}
      meta={<AdminStatusBadge domain="lot" status={auction.status} />}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <AdminPinPageButton label={auction.title} />
          <AdminLotDetailActions
            key={id}
            lotId={id}
            sellerLegalEntityId={auction.sellerLegalEntityId ?? null}
            canPublish={canPublish}
            canCancel={canCancel}
            showEditDraft={canEditDraft}
            showEditCatalog={showEditCatalog}
          />
        </div>
      }
      mobileActions={mobileActions}
      mobileActionBarTrailing={
        <LotDetailMobilePublishCancel
          lotId={id}
          sellerLegalEntityId={auction.sellerLegalEntityId ?? null}
          canPublish={canPublish}
          canCancel={canCancel}
        />
      }
      aside={
        <CatalogInfoAside
          entityId={id}
          {...(auction.updatedAt ? { updatedAt: auction.updatedAt } : {})}
          publicHref={publicHref}
          publicLabel="View on site"
          status={<AdminStatusBadge domain="lot" status={auction.status} />}
        />
      }
      tabs={
        <Suspense fallback={<TabbedQueueSkeleton />}>
          <CatalogTabPanel defaultValue="overview" syncUrl tabs={tabItems} />
        </Suspense>
      }
    >
      {sp.error_code === "connect_required" ? (
        <AdminLotConnectRequiredBanner
          sellerLegalEntityId={auction.sellerLegalEntityId ?? null}
          detail={sp.error ?? null}
        />
      ) : sp.error ? (
        <Alert variant="destructive">
          <AlertTitle>Action failed</AlertTitle>
          <AlertDescription>{sp.error}</AlertDescription>
        </Alert>
      ) : null}
    </CatalogDetailShell>
  );
}
