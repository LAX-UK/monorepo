import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadAdminVenueCreatePage } from "./load-venue-create-page";

const { resolvePlatformCatalogLegalEntity } = vi.hoisted(() => ({
  resolvePlatformCatalogLegalEntity: vi.fn(),
}));

vi.mock("@/lib/data/http/platform-catalog.server", () => ({
  resolvePlatformCatalogLegalEntity,
}));

describe("loadAdminVenueCreatePage", () => {
  beforeEach(() => {
    resolvePlatformCatalogLegalEntity.mockResolvedValue({
      ok: true,
      id: "30000000-0000-4000-9000-000000000001",
    });
  });

  it("loads platform legal entity for create form defaults", async () => {
    const model = await loadAdminVenueCreatePage();
    expect(resolvePlatformCatalogLegalEntity).toHaveBeenCalled();
    expect(model.platformLegalEntityId).toBe("30000000-0000-4000-9000-000000000001");
    expect(model.setupError).toBeNull();
  });

  it("returns actionable setup error when platform legal entity lookup fails", async () => {
    resolvePlatformCatalogLegalEntity.mockRejectedValue(new Error("network"));
    const model = await loadAdminVenueCreatePage();
    expect(model.platformLegalEntityId).toBeNull();
    expect(model.setupError).toMatch(/could not resolve/i);
  });

  it("returns configuration guidance when platform legal entity is not configured", async () => {
    resolvePlatformCatalogLegalEntity.mockResolvedValue({
      ok: false,
      reason: "not_configured",
    });
    const model = await loadAdminVenueCreatePage();
    expect(model.platformLegalEntityId).toBeNull();
    expect(model.setupError).toMatch(/PLATFORM_CATALOG_LEGAL_ENTITY_ID/i);
  });
});
