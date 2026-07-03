import type { Database } from "@auction/db";
import type {
  AdminArtistListResult,
  AdminArtistStats,
  ArtistDeleteGuardCounts,
  ArtistProfile,
  PublicArtistDirectoryResult,
} from "@auction/types";
import type { DbTransaction } from "../interfaces/artist-delete.repository.js";
import type {
  IArtistDeleteGuards,
  IArtistDeleteRepository,
} from "../interfaces/artist-delete.repository.js";
import type { AdminArtistListOptions } from "../interfaces/artist-profile-admin.reader.js";
import type { IArtistProfileAdminReader } from "../interfaces/artist-profile-admin.reader.js";
import type { IArtistProfileDirectoryReader } from "../interfaces/artist-profile-directory.reader.js";
import type {
  CreateArtistInput,
  IArtistProfileCommandRepository,
  UpdateArtistInput,
} from "../interfaces/artist-profile.repository.js";
import { DrizzleArtistProfileAdminReader } from "./drizzle-artist-profile-admin.reader.js";
import { DrizzleArtistProfileCommandRepository } from "./drizzle-artist-profile-command.repository.js";
import { DrizzleArtistProfileDirectoryReader } from "./drizzle-artist-profile-directory.reader.js";

export type { CreateArtistInput, UpdateArtistInput };

/** Composite facade preserving the pre-split repository surface for callers. */
export class DrizzleArtistProfileRepository
  implements
    IArtistProfileDirectoryReader,
    IArtistProfileAdminReader,
    IArtistProfileCommandRepository,
    IArtistDeleteGuards,
    IArtistDeleteRepository
{
  constructor(
    private readonly directory: DrizzleArtistProfileDirectoryReader,
    private readonly admin: DrizzleArtistProfileAdminReader,
    private readonly commands: DrizzleArtistProfileCommandRepository,
  ) {}

  listPublicDirectory(
    options: Parameters<IArtistProfileDirectoryReader["listPublicDirectory"]>[0],
  ): Promise<PublicArtistDirectoryResult> {
    return this.directory.listPublicDirectory(options);
  }

  findAliasesByArtistId(artistId: string): Promise<string[]> {
    return this.directory.findAliasesByArtistId(artistId);
  }

  findBySlug(slug: string): Promise<ArtistProfile | null> {
    return this.directory.findBySlug(slug);
  }

  list(options?: Parameters<IArtistProfileAdminReader["list"]>[0]): Promise<ArtistProfile[]> {
    return this.admin.list(options);
  }

  listForAdmin(options?: AdminArtistListOptions): Promise<AdminArtistListResult> {
    return this.admin.listForAdmin(options);
  }

  adminArtistStats(): Promise<AdminArtistStats> {
    return this.admin.adminArtistStats();
  }

  findById(id: string): Promise<ArtistProfile | null> {
    return this.admin.findById(id);
  }

  countLotsByArtist(artistId: string): Promise<number> {
    return this.admin.countLotsByArtist(artistId);
  }

  create(input: CreateArtistInput): Promise<ArtistProfile> {
    return this.commands.create(input);
  }

  update(id: string, input: UpdateArtistInput): Promise<ArtistProfile | null> {
    return this.commands.update(id, input);
  }

  countDeleteGuards(artistId: string, tx?: DbTransaction): Promise<ArtistDeleteGuardCounts> {
    return this.commands.countDeleteGuards(artistId, tx);
  }

  findByIdForUpdate(id: string, tx: DbTransaction): Promise<ArtistProfile | null> {
    return this.commands.findByIdForUpdate(id, tx);
  }

  deleteById(id: string, tx: DbTransaction): Promise<boolean> {
    return this.commands.deleteById(id, tx);
  }
}

export function createDrizzleArtistProfileRepository(db: Database) {
  const directory = new DrizzleArtistProfileDirectoryReader(db);
  const admin = new DrizzleArtistProfileAdminReader(db);
  const commands = new DrizzleArtistProfileCommandRepository(db);
  return new DrizzleArtistProfileRepository(directory, admin, commands);
}
