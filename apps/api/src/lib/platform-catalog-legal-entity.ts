import type { Database } from "@auction/db";
import { legalEntity } from "@auction/db/schema";
import { and, eq, inArray, ne } from "drizzle-orm";

export type PlatformCatalogLegalEntityIdProvider = () => Promise<string | null>;

const PLATFORM_CATALOG_SLUG = "lax-house-stock";
const BLOCKED_STATUSES = ["archived", "rejected"] as const;

type ProviderDeps = {
  db: Database;
  configuredId?: string | undefined;
};

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

async function findConfiguredPlatformEntity(
  db: Database,
  configuredId: string,
): Promise<string | null> {
  const rows = await db
    .select({
      id: legalEntity.id,
      kind: legalEntity.kind,
      status: legalEntity.status,
    })
    .from(legalEntity)
    .where(eq(legalEntity.id, configuredId))
    .limit(1);
  const row = rows[0];
  if (!row || !isUsablePlatformOrg(row)) return null;
  return row.id;
}

async function findLaxManagedPlatformEntity(db: Database): Promise<string | null> {
  const rows = await db
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

async function findPlatformEntityBySlug(db: Database): Promise<string | null> {
  const rows = await db
    .select({
      id: legalEntity.id,
      kind: legalEntity.kind,
      status: legalEntity.status,
    })
    .from(legalEntity)
    .where(
      and(
        eq(legalEntity.slug, PLATFORM_CATALOG_SLUG),
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

/** Resolves the platform org entity stamped on staff-created sales (`created_by_legal_entity_id`). */
export function createPlatformCatalogLegalEntityIdProvider(
  deps: ProviderDeps,
): PlatformCatalogLegalEntityIdProvider {
  let cachedId: string | null | undefined;

  return async () => {
    if (cachedId !== undefined) return cachedId;

    if (deps.configuredId) {
      const configured = await findConfiguredPlatformEntity(deps.db, deps.configuredId);
      if (configured) {
        cachedId = configured;
        return configured;
      }
    }

    const laxManaged = await findLaxManagedPlatformEntity(deps.db);
    if (laxManaged) {
      cachedId = laxManaged;
      return laxManaged;
    }

    const bySlug = await findPlatformEntityBySlug(deps.db);
    cachedId = bySlug;
    return bySlug;
  };
}
