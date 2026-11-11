import type { IdentityDatabase } from "@auction/identity-db";
import { user } from "@auction/identity-db/schema";
import { eq } from "drizzle-orm";
import {
  type ExportSource,
  SourcedExportCategory,
  inMemorySource,
} from "../../../subject-export/sourced-export-category.js";
import { iso, isoRequired } from "../../../subject-export/values.js";

type ProfileRow = {
  id: string;
  name: string;
  image: string | null;
  createdAt: Date;
  deletionRequestedAt: Date | null;
  identityDisabledAt: Date | null;
  timeZoneMode: "automatic" | "fixed";
  timeZone: string | null;
};

export function mapProfile(row: ProfileRow) {
  return {
    id: row.id,
    origin: "provided" as const,
    name: row.name,
    // Identity keeps no separate display name, language or theme: those live in the products.
    displayName: null,
    joinedAt: isoRequired(row.createdAt),
    status: row.deletionRequestedAt
      ? "pending_deletion"
      : row.identityDisabledAt
        ? "disabled"
        : "active",
    deletionRequestedAt: iso(row.deletionRequestedAt),
    language: null,
    theme: null,
    image: row.image,
    timeZoneMode: row.timeZoneMode,
    timeZone: row.timeZone,
  };
}

/** Name, join date, account status and time zone choice. The reason for a disablement is a staff note and is not read. */
export class ProfileExportCategory extends SourcedExportCategory {
  readonly id = "profile";
  protected readonly sources: readonly ExportSource[];

  constructor(db: IdentityDatabase) {
    super();
    this.sources = [
      inMemorySource(async (subjectId) => {
        const [row] = await db
          .select({
            id: user.id,
            name: user.name,
            image: user.image,
            createdAt: user.createdAt,
            deletionRequestedAt: user.deletionRequestedAt,
            identityDisabledAt: user.identityDisabledAt,
            timeZoneMode: user.timeZoneMode,
            timeZone: user.timeZone,
          })
          .from(user)
          .where(eq(user.id, subjectId))
          .limit(1);
        return row ? [{ key: row.id, record: mapProfile(row) }] : [];
      }),
    ];
  }
}
