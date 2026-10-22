import { AdminFailedPage } from "@/components/admin-fetch-state";
import { AdminListCursorNav } from "@/components/admin-list-cursor-nav";
import { ArtistsStaffListTable } from "@/components/admin-staff-list-tables.client";
import { adminListPath } from "@/server/application/admin-list-path";
import { fetchAdminJson } from "@/server/application/load-admin-data";
import { PageHeader } from "@auction/ui";
import { redirect } from "next/navigation";

type ArtistList = {
  items: Array<{
    artistId: string;
    slug: string;
    displayName: string;
    discipline: string | null;
  }>;
  nextCursor: string | null;
};

export const metadata = { title: "Artists" };

export default async function ArtistsPage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string }>;
}) {
  const { cursor } = await searchParams;
  const result = await fetchAdminJson<ArtistList>(adminListPath("artists", { cursor }));
  if (result.status === "unauthorized") redirect("/login");
  if (result.status !== "ok") {
    return <AdminFailedPage title="Artists" status={result.status} />;
  }

  return (
    <div>
      <PageHeader
        title="Artists"
        description="Artists on lax.art and LAX Shop. Open one to link their sign-in, edit their search listing and see their works."
      />
      <ArtistsStaffListTable items={result.data.items} />
      <AdminListCursorNav cursor={cursor} pathname="/artists" nextCursor={result.data.nextCursor} />
    </div>
  );
}
