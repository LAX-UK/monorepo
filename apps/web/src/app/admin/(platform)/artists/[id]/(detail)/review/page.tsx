import { ArtistReviewTab } from "@/components/admin/artist-detail/tabs/review-tab";
import { StaffActionError } from "@/components/admin/staff/staff-action-error";
import { loadAdminArtistReviewPage } from "@/lib/admin/artists/load-artist-review-page";
import { requireAdminCapability } from "@/lib/auth/require-admin-capability";
import { ARTIST_REVIEW_ACCESS } from "@/lib/navigation/staff-nav-access";
import { notFound, redirect } from "next/navigation";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
};

export default async function AdminArtistReviewPage({ params, searchParams }: Props) {
  const { id } = await params;
  await requireAdminCapability(ARTIST_REVIEW_ACCESS, `/admin/artists/${id}`);
  const sp = await searchParams;
  const model = await loadAdminArtistReviewPage(id);
  if (!model) notFound();
  if (model.artist.status !== "pending") {
    redirect(`/admin/artists/${id}`);
  }

  return (
    <>
      <StaffActionError error={sp.error} title="The review was not saved" />
      <ArtistReviewTab
        artistId={model.artistId}
        displayName={model.artist.displayName}
        currentStatus={model.artist.status}
      />
    </>
  );
}
