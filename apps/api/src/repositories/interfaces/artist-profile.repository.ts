import type { ArtistDeleteGuardCounts, ArtistProfile } from "@auction/types";
import type { adminCreateArtistBodySchema, adminUpdateArtistBodySchema } from "@auction/validators";
import type { z } from "zod";
import type { DbTransaction } from "../../services/interfaces/artist-delete.js";

export type CreateArtistInput = z.infer<typeof adminCreateArtistBodySchema> & {
  slug: string;
  createdByUserId?: string | null;
};

export type UpdateArtistInput = z.infer<typeof adminUpdateArtistBodySchema> & {
  slug?: string | undefined;
};

export interface IArtistProfileCommandRepository {
  create(input: CreateArtistInput): Promise<ArtistProfile>;
  update(id: string, input: UpdateArtistInput): Promise<ArtistProfile | null>;
  countDeleteGuards(artistId: string, tx?: DbTransaction): Promise<ArtistDeleteGuardCounts>;
  findByIdForUpdate(id: string, tx: DbTransaction): Promise<ArtistProfile | null>;
  deleteById(id: string, tx: DbTransaction): Promise<boolean>;
}
