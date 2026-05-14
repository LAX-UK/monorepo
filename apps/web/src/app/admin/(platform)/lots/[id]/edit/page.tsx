import { AdminEntityFormShell } from "@/components/admin/admin-entity-form-shell";
import { AdminLotForm } from "@/components/admin/admin-lot-form";
import { AdminLotMarketingForm } from "@/components/admin/admin-lot-marketing-form";
import { LotDocumentsSection } from "@/components/admin/lot-form/lot-documents-section";
import {
  getAdminArtistList,
  getAdminLotById,
  getAdminUserList,
} from "@/lib/data/http/admin.server";
import { getServerCategoryReader } from "@/lib/data/http/categories.server";
import { getServerLotDocuments } from "@/lib/data/http/lot-documents.server";
import { isEnglishOnlyAuctionsLocked } from "@/lib/feature-flags/english-only-auctions";
import { lotToAdminLotFormValues } from "@/lib/forms/schemas/admin-lot-defaults";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

export default async function AdminEditAuctionPage({
  params,
}: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [auction, categories, users, artistList, lotDocuments] = await Promise.all([
    getAdminLotById(id).catch(() => null),
    (async () => (await getServerCategoryReader()).tree())(),
    getAdminUserList({ limit: 100 }),
    getAdminArtistList({ includeArchived: false, limit: 500 }),
    getServerLotDocuments(id),
  ]);
  const artists = artistList.rows;
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
        <Link
          href={`/admin/lots/${id}`}
          className="font-label text-xs uppercase tracking-widest text-primary hover:underline"
        >
          ← Lot detail
        </Link>
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
          sellers={users.rows}
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
