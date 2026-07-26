import { CatalogBreadcrumbs } from "@/components/admin/catalog";
import { LotDocumentsTabBoard } from "@/components/admin/lot-detail/lot-documents-tab-board";
import { AdminLotForm } from "@/components/admin/lot-form";
import { LotEditFormLayout } from "@/components/admin/lot-form/lot-edit-form-layout";
import { AdminLotMarketingForm } from "@/components/admin/lot-marketing-form";
import { CATALOG_FORM_IDS } from "@/lib/admin/catalog-form-ids";
import { loadAdminLotEditPage } from "@/lib/admin/lots/load-lot-edit-page";
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
  const page = await loadAdminLotEditPage(id);

  if (page.redirectTo) {
    redirect(page.redirectTo);
  }

  const { auction, canEditCore, isDraft } = page;

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
                  defaultValues={page.defaultValues}
                  categories={page.categories}
                  sales={page.sales}
                  artists={page.artists}
                  englishOnlyAuctionsLocked={page.englishOnlyAuctionsLocked}
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
            artists={page.artists}
            artistId={auction.artistId ?? null}
            htmlFormId={CATALOG_FORM_IDS.lotMarketing}
            lotEditSection="catalog"
          />
        }
        documentsSection={<LotDocumentsTabBoard lotId={id} initialDocuments={page.lotDocuments} />}
      />
      {children}
    </Suspense>
  );
}
