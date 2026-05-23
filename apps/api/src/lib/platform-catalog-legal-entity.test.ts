import { describe, expect, it, vi } from "vitest";
import { createPlatformCatalogLegalEntityIdProvider } from "./platform-catalog-legal-entity.js";

const PLATFORM_ID = "30000000-0000-4000-9000-000000000001";

function dbWithRows(rows: Array<{ id: string; kind: string; status: string }>) {
  const limit = vi.fn().mockResolvedValue(rows);
  const where = vi.fn().mockReturnValue({ limit });
  const from = vi.fn().mockReturnValue({ where });
  const select = vi.fn().mockReturnValue({ from });
  return { select } as never;
}

describe("createPlatformCatalogLegalEntityIdProvider", () => {
  it("returns configured UUID when env id validates in DB", async () => {
    const provider = createPlatformCatalogLegalEntityIdProvider({
      db: dbWithRows([{ id: PLATFORM_ID, kind: "organisation", status: "approved" }]),
      configuredId: PLATFORM_ID,
    });

    await expect(provider()).resolves.toBe(PLATFORM_ID);
    await expect(provider()).resolves.toBe(PLATFORM_ID);
  });

  it("falls back to lax-managed org when env is unset", async () => {
    const provider = createPlatformCatalogLegalEntityIdProvider({
      db: dbWithRows([{ id: PLATFORM_ID, kind: "organisation", status: "approved" }]),
    });

    await expect(provider()).resolves.toBe(PLATFORM_ID);
  });

  it("returns null when no platform candidate exists", async () => {
    const provider = createPlatformCatalogLegalEntityIdProvider({
      db: dbWithRows([]),
    });

    await expect(provider()).resolves.toBeNull();
  });

  it("ignores invalid configured id and falls back to DB lookup", async () => {
    let call = 0;
    const limit = vi.fn().mockImplementation(() => {
      call += 1;
      if (call === 1) return Promise.resolve([]);
      return Promise.resolve([{ id: PLATFORM_ID, kind: "organisation", status: "approved" }]);
    });
    const where = vi.fn().mockReturnValue({ limit });
    const from = vi.fn().mockReturnValue({ where });
    const select = vi.fn().mockReturnValue({ from });

    const provider = createPlatformCatalogLegalEntityIdProvider({
      db: { select } as never,
      configuredId: "00000000-0000-4000-8000-000000000099",
    });

    await expect(provider()).resolves.toBe(PLATFORM_ID);
  });
});
