import type {
  ArtistDetailReadModel,
  ArtistSummaryReadModel,
} from "../application/read-models/catalogue.read-model.js";

export type ArtistDirectoryRow = {
  slug: string;
  name: string;
  discipline: string | null;
  bio: string | null;
  portraitImageUrl: string | null;
  artworkCount: number;
};

export function toPublicArtistSummary(row: ArtistDirectoryRow): ArtistSummaryReadModel {
  return {
    slug: row.slug,
    name: row.name,
    discipline: row.discipline,
    portraitUrl: row.portraitImageUrl,
    artworkCount: row.artworkCount,
  };
}

export function toPublicArtistDetail(row: ArtistDirectoryRow): ArtistDetailReadModel {
  return {
    ...toPublicArtistSummary(row),
    bio: row.bio,
  };
}
