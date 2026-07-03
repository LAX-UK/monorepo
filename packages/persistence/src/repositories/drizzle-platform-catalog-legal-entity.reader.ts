import type { Database } from "@auction/db";
import { legalEntity } from "@auction/db/schema";
import { and, eq, inArray, ne } from "drizzle-orm";
import type { IPlatformCatalogLegalEntityReader } from "../interfaces/platform-catalog-legal-entity.reader.js";

const PLATFORM_CATALOG_SLUG = "lax-house-stock";
const BLOCKED_STATUSES = ["archived", "rejected"] as const;

function isUsablePlatformOrg(row: {
  id: string;
  kind: string;
  status: string;
}): boolean {
  return (
    row.kind === "organisation" &&
    !BLOCKED_STATUSES.includes(row.status as (typeof BLOCKED_STATUSES)[number])
  );
}

export class DrizzlePlatformCatalogLegalEntityReader implements IPlatformCatalogLegalEntityReader {
  constructor(private readonly db: Database) {}

  async findUsableById(id: string): Promise<string | null> {
    const rows = await this.db
      .select({
        id: legalEntity.id,
        kind: legalEntity.kind,
        status: legalEntity.status,
      })
      .from(legalEntity)
      .where(eq(legalEntity.id, id))
      .limit(1);
    const row = rows[0];
    if (!row || !isUsablePlatformOrg(row)) return null;
    return row.id;
  }

  async findConfigured(configuredId: string): Promise<string | null> {
    return this.findUsableById(configuredId);
  }

  async findLaxManaged(): Promise<string | null> {
    const rows = await this.db
      .select({
        id: legalEntity.id,
        kind: legalEntity.kind,
        status: legalEntity.status,
      })
      .from(legalEntity)
      .where(
        and(
          eq(legalEntity.isLaxManaged, true),
          eq(legalEntity.kind, "organisation"),
          inArray(legalEntity.status, ["approved", "lead", "under_review", "restricted"]),
        ),
      )
      .limit(1);
    const row = rows[0];
    if (!row || !isUsablePlatformOrg(row)) return null;
    return row.id;
  }

  async findBySlug(slug: string): Promise<string | null> {
    const rows = await this.db
      .select({
        id: legalEntity.id,
        kind: legalEntity.kind,
        status: legalEntity.status,
      })
      .from(legalEntity)
      .where(
        and(
          eq(legalEntity.slug, slug),
          eq(legalEntity.kind, "organisation"),
          ne(legalEntity.status, "archived"),
          ne(legalEntity.status, "rejected"),
        ),
      )
      .limit(1);
    const row = rows[0];
    if (!row || !isUsablePlatformOrg(row)) return null;
    return row.id;
  }
}

export { PLATFORM_CATALOG_SLUG };
