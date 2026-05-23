import { ArtistReviewTab } from "@/components/admin/artist-detail/tabs/review-tab";
import { CatalogDetailActionError } from "@/components/admin/catalog/catalog-detail-action-error";
import { getAdminArtistById } from "@/lib/data/http/admin.server";
import { notFound, redirect } from "next/navigation";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
};

export default async function AdminArtistReviewPage({ params, searchParams }: Props) {
  const { id } = await params;
  const sp = await searchParams;
  const artist = await getAdminArtistById(id);
  if (!artist) notFound();
  if (artist.status !== "pending") {
    redirect(`/admin/artists/${id}`);
  }

  return (
    <>
      <CatalogDetailActionError error={sp.error} title="Could not review artist" />
      <ArtistReviewTab artistId={id} currentStatus={artist.status} />
    </>
  );
}
