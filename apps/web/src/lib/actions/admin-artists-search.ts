"use server";

import { instrumentServerAction } from "@/lib/observability/instrument-server-action";

import type { ArtistSearchHit } from "@/components/artists/artist-search";
import { denyUnlessAdminCapability } from "@/lib/auth/assert-admin-action-capability";
import { getAdminArtistList, searchAdminArtistsRegistry } from "@/lib/data/http/admin.server";
import { type ActionResult, actionFailure, actionSuccess } from "@/lib/forms/form-result";
import { ARTISTS_ACCESS } from "@/lib/navigation/staff-nav-access";
import type { AdminArtistListRow } from "@auction/types";

function listRowToSearchHit(row: AdminArtistListRow): ArtistSearchHit {
  return {
    id: row.id,
    displayName: row.displayName,
    slug: row.slug,
    kind: row.kind ?? "artist",
    status: row.status ?? "approved",
    matchedAlias: null,
    matchType: "partial",
    score: 0.85,
  };
}

/** Staff-only artist/maker/brand search for admin pickers (server session cookies). */
export async function searchAdminArtistsAction(
  query: string,
): Promise<ActionResult<ArtistSearchHit[]>> {
  return instrumentServerAction("searchAdminArtistsAction", async () => {
    const denied = await denyUnlessAdminCapability(ARTISTS_ACCESS);
    if (denied) return denied;

    const trimmed = query.trim();
    if (trimmed.length < 2) return actionSuccess([]);

    try {
      const { rows } = await getAdminArtistList({ q: trimmed, limit: 20, offset: 0 });
      const listHits = rows.filter((row) => row.status !== "merged_into").map(listRowToSearchHit);
      if (listHits.length > 0) {
        return actionSuccess(listHits);
      }

      // Registry search (aliases/fuzzy) when list ILIKE finds nothing — requires API restart
      // after `/admin/artists/search` route + UUID param constraint ship.
      const registryHits = await searchAdminArtistsRegistry(trimmed, 20);
      if (registryHits.length > 0) {
        return actionSuccess(
          registryHits
            .filter((hit) => hit.status !== "merged_into")
            .map(
              (hit): ArtistSearchHit => ({
                id: hit.id,
                displayName: hit.displayName,
                slug: hit.slug,
                kind: hit.kind,
                status: hit.status,
                matchedAlias: hit.matchedAlias,
                matchType: hit.matchType as ArtistSearchHit["matchType"],
                score: hit.score,
              }),
            ),
        );
      }

      return actionSuccess([]);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Artist search failed";
      return actionFailure(message);
    }
  });
}
