import type { ArtistKind, ArtistProfile, PublicArtistDirectoryResult } from "@auction/types";

export interface IArtistProfileDirectoryReader {
  listPublicDirectory(options: {
    limit: number;
    offset: number;
    q?: string;
    kind?: ArtistKind;
    kinds?: ArtistKind[];
    letter?: string;
    living?: boolean;
    historical?: boolean;
    nationality?: string;
    country?: string;
    categorySlug?: string;
    featuredOnly?: boolean;
    featuredFirst?: boolean;
    decade?: string;
    hasUpcoming?: boolean;
    sort?: "name_asc" | "popular" | "recent";
  }): Promise<PublicArtistDirectoryResult>;

  findAliasesByArtistId(artistId: string): Promise<string[]>;

  findBySlug(slug: string): Promise<ArtistProfile | null>;
}
