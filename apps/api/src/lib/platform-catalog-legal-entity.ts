import type {
  IPlatformCatalogLegalEntityReader,
  PlatformCatalogLegalEntityIdProvider,
} from "@auction/persistence";
import { PLATFORM_CATALOG_SLUG } from "@auction/persistence";

export type { PlatformCatalogLegalEntityIdProvider };

type ProviderDeps = {
  reader: IPlatformCatalogLegalEntityReader;
  configuredId?: string | undefined;
};

async function resolvePlatformCatalogLegalEntityId(deps: ProviderDeps): Promise<string | null> {
  if (deps.configuredId) {
    const configured = await deps.reader.findConfigured(deps.configuredId);
    if (configured) return configured;
  }

  const laxManaged = await deps.reader.findLaxManaged();
  if (laxManaged) return laxManaged;

  return deps.reader.findBySlug(PLATFORM_CATALOG_SLUG);
}

/** Resolves the platform org entity stamped on staff-created sales (`created_by_legal_entity_id`). */
export function createPlatformCatalogLegalEntityIdProvider(
  deps: ProviderDeps,
): PlatformCatalogLegalEntityIdProvider {
  let cachedId: string | undefined;

  return async () => {
    if (cachedId) {
      const stillValid = await deps.reader.findUsableById(cachedId);
      if (stillValid) return stillValid;
      cachedId = undefined;
    }

    const fresh = await resolvePlatformCatalogLegalEntityId(deps);
    if (fresh) cachedId = fresh;
    return fresh;
  };
}
