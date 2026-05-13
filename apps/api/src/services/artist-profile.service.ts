import type { ArtistKind, ArtistProfile, ArtistStatus } from "@auction/types";
import type { adminCreateArtistBodySchema, adminUpdateArtistBodySchema } from "@auction/validators";
import type { z } from "zod";
import { CategoryError } from "../lib/errors.js";
import type { DrizzleArtistProfileRepository } from "../repositories/drizzle-artist-profile.repository.js";
import type { IArtistRegistryService } from "./interfaces/artist-registry.js";

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

  getById(id: string): Promise<ArtistProfile | null> {
    return this.artists.findById(id);
  }

  async create(adminUserId: string, input: CreateArtistInput): Promise<ArtistProfile> {
    const slug = await this.registry.resolveUniqueSlug(input.slug ?? input.displayName);
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
    const slug =
      input.slug !== undefined ? await this.registry.resolveUniqueSlug(input.slug, id) : undefined;
    const patch: UpdateArtistInput & { slug?: string | undefined } = { ...input };
    if (slug !== undefined) patch.slug = slug;
    const updated = await this.artists.update(id, patch);
    if (!updated) throw new CategoryError("Artist profile not found");
    return updated;
  }
}
