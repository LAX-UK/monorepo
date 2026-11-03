import { ArtistReviewTab } from "@/components/admin/artist-detail/tabs/review-tab";
import { loadAdminArtistReviewPage } from "@/lib/admin/artists/load-artist-review-page";
import { requireAdminCapability } from "@/lib/auth/require-admin-capability";
import { ARTIST_REVIEW_ACCESS } from "@/lib/navigation/staff-nav-access";
import { notFound, redirect } from "next/navigation";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function AdminArtistReviewPage({ params }: Props) {
  const { id } = await params;
  await requireAdminCapability(ARTIST_REVIEW_ACCESS, `/admin/artists/${id}`);
  const model = await loadAdminArtistReviewPage(id);
  if (!model) notFound();
  if (model.artist.status !== "pending") {
    redirect(`/admin/artists/${id}`);
  }

  return (
    <ArtistReviewTab
      artistId={model.artistId}
      displayName={model.artist.displayName}
      currentStatus={model.artist.status}
    />
  );
}
