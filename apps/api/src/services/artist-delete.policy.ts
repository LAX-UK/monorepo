import type { ArtistDeleteGuardCounts, ArtistProfile } from "@auction/types";
import { type Result, err, ok } from "neverthrow";
import { ArtistError } from "../lib/errors.js";

export type ArtistDeleteContext = {
  artist: ArtistProfile;
  guards: ArtistDeleteGuardCounts;
};

/** Human-readable reasons delete is blocked (empty when deletable). */
export function listArtistDeleteBlockers(ctx: ArtistDeleteContext): string[] {
  const { artist, guards } = ctx;
  const blockers: string[] = [];

  if (artist.status === "merged_into") {
    blockers.push("This profile was merged — open the survivor profile instead");
  }

  if (guards.lotCount > 0) {
    blockers.push(
      guards.lotCount === 1
        ? "This artist is attributed to 1 lot"
        : `This artist is attributed to ${guards.lotCount} lots`,
    );
  }

  if (guards.mergeDependentCount > 0) {
    blockers.push(
      guards.mergeDependentCount === 1
        ? "1 profile was merged into this artist"
        : `${guards.mergeDependentCount} profiles were merged into this artist`,
    );
  }

  return blockers;
}

/** Non-blocking warnings shown in the admin UI before delete. */
export function listArtistDeleteWarnings(ctx: ArtistDeleteContext): string[] {
  const { artist, guards } = ctx;
  const warnings: string[] = [];

  if (guards.watchlistCount > 0) {
    warnings.push(
      guards.watchlistCount === 1
        ? "1 user follows this artist — their watchlist entry will be removed"
        : `${guards.watchlistCount} users follow this artist — their watchlist entries will be removed`,
    );
  }

  if (artist.featured) {
    warnings.push("This artist is featured on the public directory");
  }

  if (artist.verified) {
    warnings.push("This artist is marked as verified");
  }

  return warnings;
}

export function canArtistDelete(ctx: ArtistDeleteContext): boolean {
  return listArtistDeleteBlockers(ctx).length === 0;
}

export function validateArtistDelete(ctx: ArtistDeleteContext): Result<void, ArtistError> {
  const blockers = listArtistDeleteBlockers(ctx);
  const firstBlocker = blockers[0];
  if (firstBlocker) {
    return err(new ArtistError(firstBlocker, 422, "artist_delete_blocked", blockers));
  }

  return ok(undefined);
}
