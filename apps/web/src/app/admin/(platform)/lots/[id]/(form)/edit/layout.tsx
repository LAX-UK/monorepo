import { CatalogBreadcrumbs } from "@/components/admin/catalog";
import { AdminLotForm } from "@/components/admin/lot-form";
import { LotDocumentsSection } from "@/components/admin/lot-form/lot-documents-section";
import { LotEditFormLayout } from "@/components/admin/lot-form/lot-edit-form-layout";
import { AdminLotMarketingForm } from "@/components/admin/lot-marketing-form";
import { CATALOG_FORM_IDS } from "@/lib/admin/catalog-form-ids";
import {
  getAdminArtistList,
  getAdminLotById,
  getAdminSalesList,
} from "@/lib/data/http/admin.server";
import { getServerCategoryReader } from "@/lib/data/http/categories.server";
import { getServerLotDocuments } from "@/lib/data/http/lot-documents.server";
import { isEnglishOnlyAuctionsLocked } from "@/lib/feature-flags/english-only-auctions";
import { lotToAdminLotFormValues } from "@/lib/forms/schemas/admin-lot-defaults";
import { notFound, redirect } from "next/navigation";
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
  const [auction, categories, salesRows, artistList, lotDocuments] = await Promise.all([
    getAdminLotById(id).catch(() => null),
    (async () => (await getServerCategoryReader()).tree())(),
    getAdminSalesList({ limit: 200 }).catch(() => []),
    getAdminArtistList({ includeArchived: false, limit: 200 }),
    getServerLotDocuments(id),
  ]);
  const artists = artistList.rows;
  const sales = salesRows.map((r) => r.sale);
  if (!auction) notFound();
  if (auction.status === "ended" || auction.status === "cancelled" || auction.status === "voided") {
    redirect(`/admin/lots/${id}`);
  }

  const isDraft = auction.status === "draft";
  const canEditCore = isDraft || auction.status === "scheduled";
  const englishOnlyAuctionsLocked = isEnglishOnlyAuctionsLocked();

  return (
    <Suspense fallback={<LotEditFormLayoutFallback />}>
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
