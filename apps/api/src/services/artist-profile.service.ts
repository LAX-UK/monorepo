import type { ArtistProfile } from "@auction/types";
import type { adminCreateArtistBodySchema, adminUpdateArtistBodySchema } from "@auction/validators";
import type { z } from "zod";
import { CategoryError } from "../lib/errors.js";
import type { DrizzleArtistProfileRepository } from "../repositories/drizzle-artist-profile.repository.js";

type CreateArtistInput = z.infer<typeof adminCreateArtistBodySchema>;
type UpdateArtistInput = z.infer<typeof adminUpdateArtistBodySchema>;

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

export class ArtistProfileService {
  constructor(private readonly artists: DrizzleArtistProfileRepository) {}

  list(options: { includeArchived?: boolean; q?: string } = {}): Promise<ArtistProfile[]> {
    return this.artists.list(options);
  }

  getById(id: string): Promise<ArtistProfile | null> {
    return this.artists.findById(id);
  }

  async create(input: CreateArtistInput): Promise<ArtistProfile> {
    const slug = await this.uniqueSlug(input.slug ?? input.displayName);
    return this.artists.create({ ...input, slug });
  }

  async update(id: string, input: UpdateArtistInput): Promise<ArtistProfile> {
    const slug = input.slug !== undefined ? await this.uniqueSlug(input.slug, id) : undefined;
    const patch: UpdateArtistInput & { slug?: string | undefined } = { ...input };
    if (slug !== undefined) patch.slug = slug;
    const updated = await this.artists.update(id, patch);
    if (!updated) throw new CategoryError("Artist profile not found");
    return updated;
  }

  private async uniqueSlug(value: string, ignoreId?: string): Promise<string> {
    const base = slugify(value);
    if (!base) throw new CategoryError("Artist slug cannot be empty");
    for (let index = 0; index < 100; index += 1) {
      const candidate = index === 0 ? base : `${base}-${index + 1}`;
      const existing = await this.artists.findBySlug(candidate);
      if (!existing || existing.id === ignoreId) return candidate;
    }
    throw new CategoryError("Could not generate a unique artist slug");
  }
}
