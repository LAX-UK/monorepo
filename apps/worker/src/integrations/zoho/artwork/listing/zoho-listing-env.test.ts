import { afterEach, describe, expect, it, vi } from "vitest";
import { loadWorkerEnv } from "../../../../env.js";

const SETTINGS = {
  ZOHO_CLIENT_ID: "client",
  ZOHO_CLIENT_SECRET: "secret", // gitleaks:allow
  ZOHO_REFRESH_TOKEN: "refresh", // gitleaks:allow
  SHOP_API_INVENTORY_BASE_URL: "http://shop-api.internal:3011",
  INVENTORY_MACHINE_CLIENT_ID: "inventory",
  INVENTORY_MACHINE_CLIENT_SECRET: "inventory-machine-secret-at-least-32-chars", // gitleaks:allow
  LAX_ART_PUBLIC_URL: "https://lax.art",
  LAX_ADMIN_PUBLIC_URL: "https://admin.lax.art",
};

function stubEnv(values: Record<string, string>) {
  vi.stubEnv("DATABASE_URL", "postgres://localhost/test");
  vi.stubEnv("APP_ENV", "development");
  for (const [key, value] of Object.entries(values)) vi.stubEnv(key, value);
}

describe("ZOHO_ARTWORK_LISTING_MODE", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("is off unless it is set, and needs nothing then", () => {
    stubEnv({});
    expect(loadWorkerEnv().ZOHO_ARTWORK_LISTING_MODE).toBe("off");
  });

  it("accepts dry_run and live once every setting is there", () => {
    for (const mode of ["dry_run", "live"]) {
      stubEnv({ ...SETTINGS, ZOHO_ARTWORK_LISTING_MODE: mode });
      expect(loadWorkerEnv().ZOHO_ARTWORK_LISTING_MODE).toBe(mode);
      vi.unstubAllEnvs();
    }
  });

  it("refuses dry_run without lax.art's lookup, since a dry run reads both sides", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { SHOP_API_INVENTORY_BASE_URL: _url, ...rest } = SETTINGS;
    stubEnv({ ...rest, ZOHO_ARTWORK_LISTING_MODE: "dry_run" });
    expect(() => loadWorkerEnv()).toThrow("Invalid worker environment variables");
  });
});
