import type {
  AdminArtistListResult,
  AdminArtistStats,
  ArtistKind,
  ArtistProfile,
  ArtistStatus,
} from "@auction/types";
import type { AdminArtistListOptions } from "../../admin/admin-route-dtos.js";

export interface IArtistProfileAdminReader {
  list(options?: {
    includeArchived?: boolean;
    q?: string;
    kind?: ArtistKind;
    status?: ArtistStatus;
    ownerUserId?: string;
  }): Promise<ArtistProfile[]>;

  listForAdmin(options?: AdminArtistListOptions): Promise<AdminArtistListResult>;

  adminArtistStats(): Promise<AdminArtistStats>;

  findById(id: string): Promise<ArtistProfile | null>;

  countLotsByArtist(artistId: string): Promise<number>;
}
