import { artistDetailTabHref } from "@/lib/admin/artists/artist-detail-routes";
import type { CatalogDetailSummaryItem } from "@/lib/admin/catalog/types";
import { artistKindMeta } from "@/lib/artists/kind-presenter";
import type { ArtistProfile } from "@auction/types";

export function buildArtistSummaryItems(
  artistId: string,
  artist: ArtistProfile,
  lotCount: number,
  duplicateCount: number,
): CatalogDetailSummaryItem[] {
  const registryStatus = artist.status ?? "pending";

  return [
    {
      id: "lots",
      label: "Lots",
      value: lotCount,
      hint: lotCount === 0 ? "No attributed lots" : "View lot list",
      href: artistDetailTabHref(artistId, "lots"),
    },
    {
      id: "duplicates",
      label: "Duplicate candidates",
      value: duplicateCount,
      hint: duplicateCount === 0 ? "None suggested" : "Review merges",
      href: artistDetailTabHref(artistId, "duplicates"),
    },
    {
      id: "status",
      label: "Registry status",
      value: "",
      status: { domain: "artist", status: registryStatus },
      hint: artist.featured ? "Featured profile" : "Not featured",
    },
    {
      id: "kind",
      label: "Kind",
      value: artist.kind ? artistKindMeta(artist.kind).badge : "—",
      hint: artist.verified ? "Verified" : "Not verified",
    },
    {
      id: "archived",
      label: "Archived",
      value: artist.archived ? "Yes" : "No",
      hint: artist.nationality?.trim() || "No nationality",
    },
  ];
}
