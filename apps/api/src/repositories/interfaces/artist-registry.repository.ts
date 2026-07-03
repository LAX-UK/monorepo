import type { Database } from "@auction/db";
import type {
  ArtistRecord,
  ArtistSearchHit,
  CreateArtistInput,
  MergeArtistInput,
  MergeArtistResult,
  ReviewArtistInput,
} from "../../services/interfaces/artist-registry.js";

export interface IArtistRegistryRepository {
  forConnection(conn: Database): IArtistRegistryRepository;

  search(query: string, limit?: number): Promise<ArtistSearchHit[]>;
  findById(id: string): Promise<ArtistRecord | null>;
  findBySlug(slug: string): Promise<ArtistRecord | null>;
  checkNameAvailability(displayName: string): Promise<{
    available: boolean;
    suggestions: string[];
  }>;
  resolveUniqueSlug(input: string, ignoreArtistId?: string): Promise<string>;

  create(creatorUserId: string | null, input: CreateArtistInput): Promise<ArtistRecord>;
  addAlias(
    creatorUserId: string | null,
    artistId: string,
    alias: string,
    kind?: string,
  ): Promise<{ id: string; alias: string }>;
  merge(
    reviewerUserId: string,
    input: MergeArtistInput,
  ): Promise<{ result: MergeArtistResult; performed: boolean }>;
  review(reviewerUserId: string, artistId: string, input: ReviewArtistInput): Promise<ArtistRecord>;

  runTransaction<T>(fn: (repo: IArtistRegistryRepository, tx: Database) => Promise<T>): Promise<T>;
}
