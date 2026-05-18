import { AdminEntityFormShell } from "@/components/admin/admin-entity-form-shell";
import { AdminLotForm } from "@/components/admin/admin-lot-form";
import { AdminLotMarketingForm } from "@/components/admin/admin-lot-marketing-form";
import { LotDocumentsSection } from "@/components/admin/lot-form/lot-documents-section";
import { Breadcrumbs } from "@/components/dashboard/primitives/breadcrumbs";
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

  return (
    <AdminEntityFormShell
      maxWidthClassName="max-w-3xl"
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
      description={
        isDraft
          ? undefined
          : "Core auction fields (price, times) are locked after publish. You can still update estimate, condition, provenance, exhibitions, and the artist note below."
      }
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
        />
      ) : null}
      <AdminLotMarketingForm
        lotId={id}
        marketingDetails={auction.marketingDetails}
        artists={artists}
        artistId={auction.artistId ?? null}
      />
      <LotDocumentsSection lotId={id} initialDocuments={lotDocuments} />
    </AdminEntityFormShell>
  );
}
