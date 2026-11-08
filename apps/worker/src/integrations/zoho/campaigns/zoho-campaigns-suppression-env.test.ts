import { afterEach, describe, expect, it, vi } from "vitest";
import { loadWorkerEnv } from "../../../env.js";

function stubEnv(values: Record<string, string>) {
  vi.stubEnv("DATABASE_URL", "postgres://localhost/test");
  vi.stubEnv("APP_ENV", "development");
  for (const [key, value] of Object.entries(values)) vi.stubEnv(key, value);
}

describe("ZOHO_CAMPAIGNS_SUPPRESSION_SYNC_MODE", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("is off unless it is set", () => {
    stubEnv({});
    expect(loadWorkerEnv().ZOHO_CAMPAIGNS_SUPPRESSION_SYNC_MODE).toBe("off");
  });

  it("accepts dry_run and live once OAuth and the list key are set", () => {
    for (const mode of ["dry_run", "live"]) {
      stubEnv({
        ZOHO_CLIENT_ID: "client",
        ZOHO_CLIENT_SECRET: "secret", // gitleaks:allow
        ZOHO_REFRESH_TOKEN: "refresh", // gitleaks:allow
        ZOHO_CAMPAIGNS_LIST_KEY: "list",
        ZOHO_CAMPAIGNS_SUPPRESSION_SYNC_MODE: mode,
      });
      expect(loadWorkerEnv().ZOHO_CAMPAIGNS_SUPPRESSION_SYNC_MODE).toBe(mode);
    }
  });

  it("refuses to start in dry_run or live without them", () => {
    stubEnv({ ZOHO_CAMPAIGNS_SUPPRESSION_SYNC_MODE: "live" });
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(() => loadWorkerEnv()).toThrow();
  });
});
