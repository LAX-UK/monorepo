import { AdminArtistDuplicatesTable } from "@/components/admin/admin-artist-duplicates-table";
import { AdminArtistMergePanel } from "@/components/admin/admin-artist-merge-panel";
import { CatalogDetailTabPanel } from "@/components/admin/catalog";
import type { AdminArtistDuplicateHit } from "@/lib/data/http/admin.server";

type Props = {
  artistId: string;
  displayName: string;
  dupes: AdminArtistDuplicateHit[];
};

export function ArtistDuplicatesTab({ artistId, displayName, dupes }: Props) {
  return (
    <CatalogDetailTabPanel
      title="Duplicates"
      description="Server-suggested candidates with similar names. Merging moves aliases and lots to the surviving profile."
    >
      {dupes.length === 0 ? (
        <p className="rounded-md border border-dashed border-outline-variant/40 p-4 text-sm text-on-surface-variant">
          No duplicate candidates returned for this profile.
        </p>
      ) : (
        <AdminArtistDuplicatesTable rows={dupes} />
      )}
      <AdminArtistMergePanel fromArtistId={artistId} fromDisplayName={displayName} />
    </CatalogDetailTabPanel>
  );
}
