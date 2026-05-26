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

async function findUsablePlatformEntityById(db: Database, id: string): Promise<string | null> {
  const rows = await db
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

async function findConfiguredPlatformEntity(
  db: Database,
  configuredId: string,
): Promise<string | null> {
  return findUsablePlatformEntityById(db, configuredId);
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

async function resolvePlatformCatalogLegalEntityId(deps: ProviderDeps): Promise<string | null> {
  if (deps.configuredId) {
    const configured = await findConfiguredPlatformEntity(deps.db, deps.configuredId);
    if (configured) return configured;
  }

  const laxManaged = await findLaxManagedPlatformEntity(deps.db);
  if (laxManaged) return laxManaged;

  return findPlatformEntityBySlug(deps.db);
}

/** Resolves the platform org entity stamped on staff-created sales (`created_by_legal_entity_id`). */
export function createPlatformCatalogLegalEntityIdProvider(
  deps: ProviderDeps,
): PlatformCatalogLegalEntityIdProvider {
  let cachedId: string | undefined;

  return async () => {
    if (cachedId) {
      const stillValid = await findUsablePlatformEntityById(deps.db, cachedId);
      if (stillValid) return stillValid;
      cachedId = undefined;
    }

    const fresh = await resolvePlatformCatalogLegalEntityId(deps);
    if (fresh) cachedId = fresh;
    return fresh;
  };
}
