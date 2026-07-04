import type { IArtistRegistryRepository } from "@auction/persistence";
import type {
  ArtistRecord,
  ArtistSearchHit,
  IArtistRegistryQueryService,
  ProposeMatchesInput,
  ProposeMatchesResult,
} from "../interfaces/artist-registry.js";

/** Read-only artist registry surface: search, match browsing, and public lookup. */
export class ArtistRegistryQueryService implements IArtistRegistryQueryService {
  constructor(private readonly repo: IArtistRegistryRepository) {}

  search(query: string, limit = 10): Promise<ArtistSearchHit[]> {
    return this.repo.search(query, limit);
  }

  async proposeMatches(input: ProposeMatchesInput): Promise<ProposeMatchesResult> {
    const limit = input.limit ?? 5;
    const all = await this.search(input.name, limit * 3);
    return {
      exact: all.filter((h) => h.matchType === "exact").slice(0, limit),
      alias: all.filter((h) => h.matchType === "alias").slice(0, limit),
      fuzzy: all
        .filter((h) => h.matchType === "fuzzy" || h.matchType === "partial")
        .slice(0, limit),
    };
  }

  findById(id: string): Promise<ArtistRecord | null> {
    return this.repo.findById(id);
  }

  findBySlug(slug: string): Promise<ArtistRecord | null> {
    return this.repo.findBySlug(slug);
  }

  checkNameAvailability(displayName: string) {
    return this.repo.checkNameAvailability(displayName);
  }
}
