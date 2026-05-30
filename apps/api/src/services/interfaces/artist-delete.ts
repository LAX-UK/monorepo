import type { Database } from "@auction/db";
import type { ArtistDeleteGuardCounts, ArtistProfile } from "@auction/types";

export type { ArtistDeleteGuardCounts };

export type DbTransaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

export interface IArtistDeleteGuards {
  countDeleteGuards(artistId: string, tx?: DbTransaction): Promise<ArtistDeleteGuardCounts>;
}

export interface IArtistDeleteRepository {
  findById(artistId: string): Promise<ArtistProfile | null>;
  findByIdForUpdate(artistId: string, tx: DbTransaction): Promise<ArtistProfile | null>;
  deleteById(artistId: string, tx: DbTransaction): Promise<boolean>;
}
