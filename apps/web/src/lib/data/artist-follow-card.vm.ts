import type { ArtistKind } from "@auction/types";

/** Display model for a followed-artist card on the watchlist Artists tab. */
export type ArtistFollowCardVm = {
  watchlistId: string;
  artistId: string;
  displayName: string;
  portraitUrl: string | null;
  shortBio: string | null;
  nationality: string | null;
  birthYear: string | null;
  deathYear: string | null;
  kind?: ArtistKind;
  followedAtMs: number;
};
