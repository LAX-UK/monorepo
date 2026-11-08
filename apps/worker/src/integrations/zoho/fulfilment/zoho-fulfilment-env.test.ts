import { afterEach, describe, expect, it, vi } from "vitest";
import { loadWorkerEnv } from "../../../env.js";

const SETTINGS = {
  ZOHO_CLIENT_ID: "client",
  ZOHO_CLIENT_SECRET: "secret", // gitleaks:allow
  ZOHO_REFRESH_TOKEN: "refresh", // gitleaks:allow
};

function stubEnv(values: Record<string, string>) {
  vi.stubEnv("DATABASE_URL", "postgres://localhost/test");
  vi.stubEnv("APP_ENV", "development");
  for (const [key, value] of Object.entries(values)) vi.stubEnv(key, value);
}

describe("ZOHO_FULFILMENT_MIRROR_MODE", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("is off unless it is set, and needs nothing then", () => {
    stubEnv({});
    expect(loadWorkerEnv().ZOHO_FULFILMENT_MIRROR_MODE).toBe("off");
  });

  it("accepts dry_run and live once the Zoho credentials are there", () => {
    for (const mode of ["dry_run", "live"]) {
      stubEnv({ ...SETTINGS, ZOHO_FULFILMENT_MIRROR_MODE: mode });
      expect(loadWorkerEnv().ZOHO_FULFILMENT_MIRROR_MODE).toBe(mode);
      vi.unstubAllEnvs();
    }
  });

  it("refuses dry_run without the Zoho credentials, since a dry run reads Zoho", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    stubEnv({ ZOHO_FULFILMENT_MIRROR_MODE: "dry_run" });
    expect(() => loadWorkerEnv()).toThrow("Invalid worker environment variables");
  });
});
