import { shopUserProfile } from "@auction/db/schema";
import {
  type ExportSource,
  SourcedExportCategory,
  inMemorySource,
} from "@auction/identity-contracts/subject-export-readers";
import { eq } from "drizzle-orm";
import type { SubjectExportDeps } from "../subject-export-deps.js";
import { isoRequired } from "../subject-export-values.js";

export function mapShopProfile(row: {
  subjectId: string;
  name: string | null;
  email: string | null;
  createdAt: Date;
}) {
  return {
    id: row.subjectId,
    origin: "provided" as const,
    displayName: row.name,
    email: row.email,
    createdAt: isoRequired(row.createdAt),
  };
}

/**
 * The Shop profile row only. The merge pointer and the disabled flag are account administration,
 * not something the person provided, and Shop stores no interface preferences with the profile.
 */
export class ShopProfileCategory extends SourcedExportCategory {
  readonly id = "shop-profile";
  protected readonly sources: readonly ExportSource[];

  constructor({ db }: SubjectExportDeps) {
    super();
    this.sources = [
      inMemorySource(async (s) => {
        const [row] = await db
          .select({
            name: shopUserProfile.name,
            email: shopUserProfile.email,
            createdAt: shopUserProfile.createdAt,
          })
          .from(shopUserProfile)
          .where(eq(shopUserProfile.identitySubjectId, s))
          .limit(1);
        return row ? [{ key: s, record: mapShopProfile({ subjectId: s, ...row }) }] : [];
      }),
    ];
  }
}
