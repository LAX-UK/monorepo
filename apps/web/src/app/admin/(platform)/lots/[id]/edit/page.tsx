import { CatalogFormShell } from "@/components/admin/catalog/catalog-form-shell";
import { AdminLotForm } from "@/components/admin/lot-form";
import { LotDocumentsSection } from "@/components/admin/lot-form/lot-documents-section";
import { AdminLotMarketingForm } from "@/components/admin/lot-marketing-form";
import { Breadcrumbs } from "@/components/dashboard/primitives/breadcrumbs";
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

export default async function AdminEditLotPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [auction, categories, salesRows, artistList, lotDocuments] = await Promise.all([
    getAdminLotById(id).catch(() => null),
    (async () => (await getServerCategoryReader()).tree())(),
    getAdminSalesList({ limit: 200 }).catch(() => []),
    getAdminArtistList({ includeArchived: false, limit: 500 }),
    getServerLotDocuments(id),
  ]);
  const artists = artistList.rows;
  const sales = salesRows.map((r) => r.sale);
  if (!auction) notFound();
  if (auction.status === "ended" || auction.status === "cancelled") {
    redirect(`/admin/lots/${id}`);
  }

  const isDraft = auction.status === "draft";
  const englishOnlyAuctionsLocked = isEnglishOnlyAuctionsLocked();

  const mobileActions = isDraft
    ? [
        {
          id: "save-lot",
          label: "Save lot",
          variant: "primary" as const,
          htmlForm: CATALOG_FORM_IDS.lot,
        },
        {
          id: "save-marketing",
          label: "Save story",
          variant: "secondary" as const,
          htmlForm: CATALOG_FORM_IDS.lotMarketing,
        },
        {
          id: "cancel",
          label: "Cancel",
          variant: "secondary" as const,
          href: `/admin/lots/${id}`,
        },
      ]
    : [
        {
          id: "save-marketing",
          label: "Save catalog",
          variant: "primary" as const,
          htmlForm: CATALOG_FORM_IDS.lotMarketing,
        },
        {
          id: "cancel",
          label: "Cancel",
          variant: "secondary" as const,
          href: `/admin/lots/${id}`,
        },
      ];

  return (
    <CatalogFormShell
      breadcrumbs={
        <Breadcrumbs
          items={[
            { label: "Lots", href: "/admin/lots" },
            { label: auction.title, href: `/admin/lots/${id}` },
          ]}
          current="Edit"
        />
      }
      title={isDraft ? "Edit draft" : "Edit catalog copy"}
      {...(isDraft
        ? {}
        : {
            description:
              "Core auction fields (price, times) are locked after publish. You can still update estimate, condition, provenance, exhibitions, and the artist note below.",
          })}
      mobileActions={mobileActions}
    >
      {isDraft ? (
        <AdminLotForm
          mode="edit"
          lotId={id}
          defaultValues={lotToAdminLotFormValues(auction)}
          categories={categories}
          sales={sales}
          artists={artists}
          englishOnlyAuctionsLocked={englishOnlyAuctionsLocked}
          htmlFormId={CATALOG_FORM_IDS.lot}
        />
      ) : null}
      <AdminLotMarketingForm
        lotId={id}
        marketingDetails={auction.marketingDetails}
        artists={artists}
        artistId={auction.artistId ?? null}
        htmlFormId={CATALOG_FORM_IDS.lotMarketing}
      />
      <LotDocumentsSection lotId={id} initialDocuments={lotDocuments} />
    </CatalogFormShell>
  );
}
