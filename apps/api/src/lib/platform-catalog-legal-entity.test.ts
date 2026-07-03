import type { IPlatformCatalogLegalEntityReader } from "@auction/persistence";
import { describe, expect, it, vi } from "vitest";
import { createPlatformCatalogLegalEntityIdProvider } from "./platform-catalog-legal-entity.js";

const PLATFORM_ID = "30000000-0000-4000-9000-000000000001";

function reader(
  overrides: Partial<IPlatformCatalogLegalEntityReader> = {},
): IPlatformCatalogLegalEntityReader {
  return {
    findConfigured: vi.fn().mockResolvedValue(null),
    findLaxManaged: vi.fn().mockResolvedValue(null),
    findBySlug: vi.fn().mockResolvedValue(null),
    findUsableById: vi.fn().mockResolvedValue(null),
    ...overrides,
  };
}

describe("createPlatformCatalogLegalEntityIdProvider", () => {
  it("returns configured UUID when env id validates in DB", async () => {
    const mockReader = reader({
      findConfigured: vi.fn().mockResolvedValue(PLATFORM_ID),
      findUsableById: vi.fn().mockResolvedValue(PLATFORM_ID),
    });
    const provider = createPlatformCatalogLegalEntityIdProvider({
      reader: mockReader,
      configuredId: PLATFORM_ID,
    });

    await expect(provider()).resolves.toBe(PLATFORM_ID);
    await expect(provider()).resolves.toBe(PLATFORM_ID);
  });

  it("falls back to lax-managed org when env is unset", async () => {
    const provider = createPlatformCatalogLegalEntityIdProvider({
      reader: reader({ findLaxManaged: vi.fn().mockResolvedValue(PLATFORM_ID) }),
    });

    await expect(provider()).resolves.toBe(PLATFORM_ID);
  });

  it("returns null when no platform candidate exists", async () => {
    const provider = createPlatformCatalogLegalEntityIdProvider({
      reader: reader(),
    });

    await expect(provider()).resolves.toBeNull();
  });

  it("ignores invalid configured id and falls back to DB lookup", async () => {
    const mockReader = reader({
      findConfigured: vi.fn().mockResolvedValue(null),
      findLaxManaged: vi.fn().mockResolvedValue(PLATFORM_ID),
    });
    const provider = createPlatformCatalogLegalEntityIdProvider({
      reader: mockReader,
      configuredId: "00000000-0000-4000-8000-000000000099",
    });

    await expect(provider()).resolves.toBe(PLATFORM_ID);
  });

  it("re-resolves when a cached platform id disappears from the database", async () => {
    const staleId = "20000000-0000-4000-8000-000000000005";
    const findUsableById = vi.fn().mockResolvedValueOnce(null);
    const findLaxManaged = vi.fn().mockResolvedValueOnce(staleId).mockResolvedValue(PLATFORM_ID);

    const provider = createPlatformCatalogLegalEntityIdProvider({
      reader: reader({ findUsableById, findLaxManaged }),
    });

    await expect(provider()).resolves.toBe(staleId);
    await expect(provider()).resolves.toBe(PLATFORM_ID);
  });
});
