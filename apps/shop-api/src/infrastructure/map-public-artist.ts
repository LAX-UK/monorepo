import type {
  ArtistDetailReadModel,
  ArtistSummaryReadModel,
} from "../application/read-models/catalogue.read-model.js";

export type ArtistDirectoryRow = {
  slug: string;
  name: string;
  discipline: string | null;
  bio: string | null;
  shortBio: string | null;
  portraitImageUrl: string | null;
  heroMediaKey: string | null;
  nationality: string | null;
  birthYear: number | null;
  deathYear: number | null;
  seoTitle: string | null;
  seoDescription: string | null;
  artworkCount: number;
  portraitUrl: string | null;
  heroUrl: string | null;
};

export function toPublicArtistSummary(row: ArtistDirectoryRow): ArtistSummaryReadModel {
  return {
    slug: row.slug,
    name: row.name,
    discipline: row.discipline,
    portraitUrl: row.portraitUrl,
    artworkCount: row.artworkCount,
  };
}

export function toPublicArtistDetail(row: ArtistDirectoryRow): ArtistDetailReadModel {
  return {
    ...toPublicArtistSummary(row),
    bio: row.bio,
    shortBio: row.shortBio,
    heroUrl: row.heroUrl,
    nationality: row.nationality,
    birthYear: row.birthYear,
    deathYear: row.deathYear,
    seoTitle: row.seoTitle,
    seoDescription: row.seoDescription,
  };
}
