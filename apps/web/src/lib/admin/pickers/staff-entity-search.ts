import { searchAdminArtistsAction } from "@/lib/actions/admin-artists-search";
import { searchAdminLegalEntitiesBrowseAction } from "@/lib/actions/admin-legal-entities-browse";
import { staffStatus } from "@/lib/admin/staff-kit-status";
import { artistKindMeta } from "@/lib/artists/kind-presenter";
import type { EntityOption } from "@auction/staff-ui";
import type { ArtistKind } from "@auction/types";

/** Legal entities by name for a kit picker, each with its status as the right-hand detail. */
export async function searchLegalEntityOptions(query: string): Promise<EntityOption[]> {
  const result = await searchAdminLegalEntitiesBrowseAction({
    ...(query.trim() ? { q: query.trim() } : {}),
    limit: 25,
    offset: 0,
  });
  if (!result.ok) throw new Error(result.error || "Search failed");
  return (result.data?.rows ?? []).map((row) => ({
    id: row.id,
    label: row.displayName,
    meta: staffStatus("legalEntity", row.status).label,
  }));
}

/** An artist as a picker option: the name, with its kind and slug to tell namesakes apart. */
export function artistOption(artist: {
  id: string;
  displayName: string;
  slug: string;
  kind?: ArtistKind | null | undefined;
}): EntityOption {
  return {
    id: artist.id,
    label: artist.displayName,
    description: `${artistKindMeta(artist.kind ?? "artist").label} · /${artist.slug}`,
  };
}

/** Artists, makers and brands by name, for a kit picker; two letters start the search. */
export async function searchArtistOptions(query: string): Promise<EntityOption[]> {
  if (query.trim().length < 2) return [];
  const result = await searchAdminArtistsAction(query);
  if (!result.ok) throw new Error(result.error || "Search failed");
  return (result.data ?? []).map(artistOption);
}
