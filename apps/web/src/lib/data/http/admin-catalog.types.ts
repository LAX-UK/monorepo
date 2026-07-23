import type { ArtistKind, ArtistStatus } from "@auction/types";

export type GetAdminCategoryPageParams = {
  includeArchived?: boolean;
  q?: string;
  limit?: number;
  offset?: number;
};

export type GetAdminArtistListParams = {
  includeArchived?: boolean;
  archivedOnly?: boolean;
  q?: string;
  kind?: string;
  kinds?: string;
  status?: string;
  ownerUserId?: string;
  categoryId?: string;
  country?: string;
  featured?: boolean;
  verified?: boolean;
  linked?: "yes" | "no";
  sort?: string;
  limit?: number;
  offset?: number;
};

/** Matches {@link adminArtistListQuerySchema} max on the API. */
export const ADMIN_ARTIST_LIST_MAX_LIMIT = 200;

export type AdminArtistDuplicateHit = {
  id: string;
  displayName: string;
  slug: string;
  kind: ArtistKind;
  status: ArtistStatus;
  matchedAlias: string | null;
  matchType: string;
  score: number;
};
