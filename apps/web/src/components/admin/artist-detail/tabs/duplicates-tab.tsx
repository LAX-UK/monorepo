import { AdminArtistDuplicatesTable } from "@/components/admin/admin-artist-duplicates-table";
import { AdminArtistMergePanel } from "@/components/admin/admin-artist-merge-panel";
import type { AdminArtistDuplicateHit } from "@/lib/data/http/admin.server";
import { Section } from "@auction/staff-ui";

type Props = {
  artistId: string;
  displayName: string;
  dupes: AdminArtistDuplicateHit[];
};

/** Profiles with a similar name, and the merge that folds this one into another. */
export function ArtistDuplicatesTab({ artistId, displayName, dupes }: Props) {
  return (
    <>
      <Section
        title="Possible duplicates"
        description="Profiles with a similar name. Open one to compare it with this profile."
        bodyClassName="p-0"
      >
        <AdminArtistDuplicatesTable rows={dupes} />
      </Section>
      <AdminArtistMergePanel fromArtistId={artistId} fromDisplayName={displayName} />
    </>
  );
}
