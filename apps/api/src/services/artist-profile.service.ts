import type {
  AdminArtistListResult,
  AdminArtistStats,
  ArtistKind,
  ArtistProfile,
  ArtistStatus,
  PublicArtistDetail,
  PublicArtistDirectoryResult,
} from "@auction/types";
import type { adminCreateArtistBodySchema, adminUpdateArtistBodySchema } from "@auction/validators";
import type { z } from "zod";
import type { AdminArtistListOptions } from "../admin/admin-route-dtos.js";
import { CategoryError } from "../lib/errors.js";
import type { DrizzleArtistProfileRepository } from "../repositories/drizzle-artist-profile.repository.js";
import type { ArtistSearchHit, IArtistRegistryService } from "./interfaces/artist-registry.js";

type CreateArtistInput = z.infer<typeof adminCreateArtistBodySchema>;
type UpdateArtistInput = z.infer<typeof adminUpdateArtistBodySchema>;

/** Thin admin facade over the artist registry.
 *
 * SOLID notes:
 * - SRP: this class only handles the admin/CRUD-shaped surface (list,
 *   listPublic, create, update). Search / merge / review / alias logic belongs
 *   on `IArtistRegistryService` and is consumed via DI here.
 * - DIP: depends on the `IArtistRegistryService` abstraction for shared
 *   logic (slug resolution) instead of importing the concrete service.
 * - ISP: routes that only need lookup (e.g. `GET /artists/public`) talk
 *   directly to this facade, while the registry interface stays focused on
 *   curation primitives. */
export class ArtistProfileService {
  constructor(
    private readonly artists: DrizzleArtistProfileRepository,
    private readonly registry: IArtistRegistryService,
  ) {}

  list(
    options: {
      includeArchived?: boolean;
      q?: string;
      kind?: ArtistKind;
      status?: ArtistStatus;
      ownerUserId?: string;
    } = {},
  ): Promise<ArtistProfile[]> {
    return this.artists.list(options);
  }

  listForAdmin(options: AdminArtistListOptions = {}): Promise<AdminArtistListResult> {
    return this.artists.listForAdmin(options);
  }

  adminArtistStats(): Promise<AdminArtistStats> {
    return this.artists.adminArtistStats();
  }

  /** Fuzzy / exact / alias matches for merge review (excludes self + merged_into). */
  async listDuplicateCandidates(artistId: string, limit = 15): Promise<ArtistSearchHit[]> {
    const me = await this.artists.findById(artistId);
    if (!me) return [];
    const hits = await this.registry.search(me.displayName, limit + 8);
    return hits.filter((h) => h.id !== artistId).slice(0, limit);
  }

  /** Public directory: approved + not archived, ordered by featured then name.
   * Used by the marketing artist directory and the home-page rail. Pagination
   * is best-effort; the registry stays small enough that we sort in JS. */
  async listPublic(options: { limit: number; offset: number }): Promise<ArtistProfile[]> {
    const all = await this.artists.list({ includeArchived: false, status: "approved" });
    const sorted = all.sort((a, b) => {
      const af = a.featured ? 1 : 0;
      const bf = b.featured ? 1 : 0;
      if (af !== bf) return bf - af;
      return a.displayName.localeCompare(b.displayName);
    });
    return sorted.slice(options.offset, options.offset + options.limit);
  }

  browsePublic(options: {
    limit: number;
    offset: number;
    q?: string;
    kind?: ArtistKind;
    kinds?: ArtistKind[];
    letter?: string;
    living?: boolean;
    historical?: boolean;
    nationality?: string;
    featuredOnly?: boolean;
    featuredFirst?: boolean;
    decade?: string;
    hasUpcoming?: boolean;
    sort?: "name_asc" | "popular" | "recent";
  }): Promise<PublicArtistDirectoryResult> {
    return this.artists.listPublicDirectory(options);
  }

  getById(id: string): Promise<ArtistProfile | null> {
    return this.artists.findById(id);
  }

  /** Public artist detail with aliases for the profile hero chips. */
  async getPublicDetail(id: string): Promise<PublicArtistDetail | null> {
    const found = await this.artists.findById(id);
    if (!found) return null;
    if (found.status !== "approved" || found.archived) return null;
    const aliases = await this.artists.findAliasesByArtistId(id);
    return { ...found, aliases };
  }

  async create(adminUserId: string, input: CreateArtistInput): Promise<ArtistProfile> {
    const slug = await this.registry.resolveUniqueSlug(input.displayName);
    // Schema validators leave kind/status optional so the admin form input
    // and output types stay aligned. The defaults are applied here so the
    // API contract remains "admin-created profiles default to artist /
    // approved" from the caller's point of view.
    return this.artists.create({
      ...input,
      slug,
      kind: input.kind ?? "artist",
      status: input.status ?? "approved",
      createdByUserId: adminUserId,
    });
  }

  async update(id: string, input: UpdateArtistInput): Promise<ArtistProfile> {
    const updated = await this.artists.update(id, input);
    if (!updated) throw new CategoryError("Artist profile not found");
    return updated;
  }
}
