import type {
  AdminArtistListResult,
  AdminArtistStats,
  ArtistKind,
  ArtistProfile,
  ArtistStatus,
} from "@auction/types";

export type AdminArtistListSort =
  | "name_asc"
  | "name_desc"
  | "updated_desc"
  | "updated_asc"
  | "lots_desc"
  | "lots_asc"
  | "status_asc"
  | "status_desc";

export type AdminArtistListLinkedFilter = "any" | "yes" | "no";

export type AdminArtistListOptions = {
  includeArchived?: boolean;
  archivedOnly?: boolean;
  q?: string;
  kind?: ArtistKind;
  /** When set, restricts to these kinds (e.g. brand+marque). Takes precedence over `kind`. */
  kinds?: ArtistKind[];
  status?: ArtistStatus;
  ownerUserId?: string;
  /** Filter by collecting category (department) id. */
  categoryId?: string;
  /** Filter by ISO 3166-1 alpha-2 origin country code. */
  country?: string;
  featured?: boolean;
  verified?: boolean;
  linked?: AdminArtistListLinkedFilter;
  sort?: AdminArtistListSort;
  limit?: number;
  offset?: number;
};

export interface IArtistProfileAdminReader {
  list(options?: {
    includeArchived?: boolean;
    q?: string;
    kind?: ArtistKind;
    status?: ArtistStatus;
    ownerUserId?: string;
  }): Promise<ArtistProfile[]>;

  listForAdmin(options?: AdminArtistListOptions): Promise<AdminArtistListResult>;

  adminArtistStats(): Promise<AdminArtistStats>;

  findById(id: string): Promise<ArtistProfile | null>;

  countLotsByArtist(artistId: string): Promise<number>;
}
