import "server-only";

import { resolvePlatformCatalogLegalEntity } from "@/lib/data/http/platform-catalog.server";

export type VenueCreatePageModel = {
  platformLegalEntityId: string | null;
  setupError: string | null;
};

function venueCreateSetupError(
  result: Awaited<ReturnType<typeof resolvePlatformCatalogLegalEntity>>,
): string {
  if (result.ok) return "Unexpected venue create setup state.";
  if (result.reason === "not_configured") {
    return "Platform catalogue organisation is not configured. Set PLATFORM_CATALOG_LEGAL_ENTITY_ID before creating venues.";
  }
  return "Could not resolve the platform catalogue organisation for venue creation.";
}

/** Data/composition boundary for `/admin/venues/new`. */
export async function loadAdminVenueCreatePage(): Promise<VenueCreatePageModel> {
  const platformCatalog = await resolvePlatformCatalogLegalEntity().catch(
    (): Awaited<ReturnType<typeof resolvePlatformCatalogLegalEntity>> => ({
      ok: false,
      reason: "lookup_failed",
    }),
  );

  if (!platformCatalog.ok) {
    return {
      platformLegalEntityId: null,
      setupError: venueCreateSetupError(platformCatalog),
    };
  }

  return {
    platformLegalEntityId: platformCatalog.id,
    setupError: null,
  };
}
