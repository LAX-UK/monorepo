import { AdminFetchState } from "@/components/admin-fetch-state";
import { AdminListCursorNav } from "@/components/admin-list-cursor-nav";
import { ArtistsStaffListTable } from "@/components/admin-staff-list-tables.client";
import { adminListPath } from "@/server/application/admin-list-path";
import { fetchAdminJson } from "@/server/application/load-admin-data";
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

export default async function ArtistsPage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string }>;
}) {
  const { cursor } = await searchParams;
  const result = await fetchAdminJson<ArtistList>(adminListPath("artists", { cursor }));
  if (result.status === "unauthorized") redirect("/login");
  if (result.status !== "ok") {
    return (
      <div>
        <h1 className="mb-6 text-2xl font-semibold">Artists</h1>
        <AdminFetchState status={result.status} />
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold">Artists</h1>
      <ArtistsStaffListTable items={result.data.items} />
      <AdminListCursorNav pathname="/artists" nextCursor={result.data.nextCursor} />
    </div>
  );
}
