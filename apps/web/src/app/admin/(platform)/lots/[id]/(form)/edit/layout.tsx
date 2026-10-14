import { AtgEditAlert } from "@/components/admin/atg/atg-edit-alert";
import { CatalogBreadcrumbs } from "@/components/admin/catalog";
import { AdminLotForm } from "@/components/admin/lot-form";
import { LotDocumentsSection } from "@/components/admin/lot-form/lot-documents-section";
import { LotEditFormLayout } from "@/components/admin/lot-form/lot-edit-form-layout";
import { AdminLotMarketingForm } from "@/components/admin/lot-marketing-form";
import { CATALOG_FORM_IDS } from "@/lib/admin/catalog-form-ids";
import { loadAdminLotRecord } from "@/lib/admin/load-lot-detail";
import { getLotFormAssignableSales } from "@/lib/admin/lot-form-sales";
import { requireAdminCapability } from "@/lib/auth/require-admin-capability";
import { getAdminArtistList } from "@/lib/data/http/admin.server";
import { getAtgIntegrationStatus, getAtgSaleSellingPlatform } from "@/lib/data/http/atg.server";
import { getServerCategoryReader } from "@/lib/data/http/categories.server";
import { getServerLotDocuments } from "@/lib/data/http/lot-documents.server";
import { isEnglishOnlyAuctionsLocked } from "@/lib/feature-flags/english-only-auctions";
import { lotToAdminLotFormValues } from "@/lib/forms/schemas/admin-lot-defaults";
import { SALES_ACCESS } from "@/lib/navigation/staff-nav-access";
import { type UserRole, userHasAccessTo } from "@auction/types";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { Suspense } from "react";

function LotEditFormLayoutFallback() {
  return null;
}

type Props = {
  params: Promise<{ id: string }>;
  children: ReactNode;
};

export default async function AdminEditLotLayout({ params, children }: Props) {
  const { id } = await params;
  const auction = await loadAdminLotRecord(id);
  const [categories, salesResult, artistList, lotDocuments] = await Promise.all([
    (async () => (await getServerCategoryReader()).tree())(),
    getLotFormAssignableSales(auction?.saleId).catch(() => getLotFormAssignableSales()),
    getAdminArtistList({ includeArchived: false, limit: 200 }),
    getServerLotDocuments(id),
  ]);
  const sales = salesResult.sales;
  const artists = artistList.rows;
  if (auction.status === "ended" || auction.status === "cancelled" || auction.status === "voided") {
    redirect(`/admin/lots/${id}`);
  }

  const isDraft = auction.status === "draft";
  const canEditCore = isDraft || auction.status === "scheduled";
  const englishOnlyAuctionsLocked = isEnglishOnlyAuctionsLocked();

  let atgEditAlert: ReactNode = null;
  if (auction.saleId) {
    const user = await requireAdminCapability(SALES_ACCESS).catch(() => null);
    const canSeeAtg =
      user != null && userHasAccessTo(user.role as UserRole, user.staffRole ?? null, SALES_ACCESS);
    if (canSeeAtg) {
      const atgStatus = await getAtgIntegrationStatus().catch(() => ({
        enabled: false,
        whiteLabelBaseUrl: null,
      }));
      if (atgStatus.enabled) {
        const platform = await getAtgSaleSellingPlatform(auction.saleId);
        if (platform === "atg") {
          atgEditAlert = <AtgEditAlert saleId={auction.saleId} />;
        }
      }
    }
  }

  return (
    <Suspense fallback={<LotEditFormLayoutFallback />}>
      {atgEditAlert}
      <LotEditFormLayout
        lotId={id}
        canEditCore={canEditCore}
        title={isDraft ? "Edit draft" : canEditCore ? "Edit lot" : "Edit catalog copy"}
        description={
          canEditCore
            ? "Switch sections to edit auction setup, catalog copy, or staff documents."
            : "Catalog copy and documents only — core auction fields are locked while live."
        }
        breadcrumbs={
          <CatalogBreadcrumbs
            segments={[
              { label: "Lots", href: "/admin/lots" },
              { label: auction.title, href: `/admin/lots/${id}` },
              { label: "Edit" },
            ]}
          />
        }
        {...(canEditCore
          ? {
              auctionSection: (
                <AdminLotForm
                  mode="edit"
                  lotId={id}
                  defaultValues={lotToAdminLotFormValues(auction)}
                  categories={categories}
                  sales={sales}
                  artists={artists}
                  englishOnlyAuctionsLocked={englishOnlyAuctionsLocked}
                  htmlFormId={CATALOG_FORM_IDS.lot}
                  showArtistField={false}
                  lotEditSection="auction"
                />
              ),
            }
          : {})}
        catalogSection={
          <AdminLotMarketingForm
            lotId={id}
            marketingDetails={auction.marketingDetails}
            artists={artists}
            artistId={auction.artistId ?? null}
            htmlFormId={CATALOG_FORM_IDS.lotMarketing}
            lotEditSection="catalog"
          />
        }
        documentsSection={<LotDocumentsSection lotId={id} initialDocuments={lotDocuments} />}
      />
      {children}
    </Suspense>
  );
}
