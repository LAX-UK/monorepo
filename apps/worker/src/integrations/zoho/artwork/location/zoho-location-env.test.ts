import { afterEach, describe, expect, it, vi } from "vitest";
import { loadWorkerEnv } from "../../../../env.js";
import {
  assertZohoCrmLiveRequiresExpectedOrg,
  shouldRunZohoCrmOrgCheck,
} from "../../zoho-crm-org-check.js";

const ZOHO = {
  ZOHO_CLIENT_ID: "client",
  ZOHO_CLIENT_SECRET: "secret", // gitleaks:allow
  ZOHO_REFRESH_TOKEN: "refresh", // gitleaks:allow
};

function stubEnv(values: Record<string, string>) {
  vi.stubEnv("DATABASE_URL", "postgres://localhost/test");
  vi.stubEnv("APP_ENV", "development");
  for (const [key, value] of Object.entries(values)) vi.stubEnv(key, value);
}

describe("ZOHO_ARTWORK_LOCATION_MODE", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("is off unless it is set, and needs nothing then", () => {
    stubEnv({});
    expect(loadWorkerEnv().ZOHO_ARTWORK_LOCATION_MODE).toBe("off");
  });

  it("accepts dry_run and live with the Zoho settings", () => {
    for (const mode of ["dry_run", "live"]) {
      stubEnv({ ...ZOHO, ZOHO_CRM_EXPECTED_ORG_TYPE: "sandbox", ZOHO_ARTWORK_LOCATION_MODE: mode });
      expect(loadWorkerEnv().ZOHO_ARTWORK_LOCATION_MODE).toBe(mode);
      vi.unstubAllEnvs();
    }
  });

  it("refuses dry_run without the Zoho settings, since a dry run reads Zoho", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    stubEnv({ ZOHO_ARTWORK_LOCATION_MODE: "dry_run" });
    expect(() => loadWorkerEnv()).toThrow("Invalid worker environment variables");
  });

  it("refuses live outside production unless pinned to a sandbox org", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    stubEnv({ ...ZOHO, ZOHO_ARTWORK_LOCATION_MODE: "live" });
    expect(() => loadWorkerEnv()).toThrow("Invalid worker environment variables");
  });

  it("turns on the wrong-org guard in live only", () => {
    const base = { ZOHO_CRM_SYNC_MODE: "off", ZOHO_CRM_EXPECTED_ORG_TYPE: "production" } as const;
    const env = (mode: string) => ({ ...base, ZOHO_ARTWORK_LOCATION_MODE: mode }) as never;
    expect(shouldRunZohoCrmOrgCheck(env("live"))).toBe(true);
    expect(shouldRunZohoCrmOrgCheck(env("dry_run"))).toBe(false);
    expect(shouldRunZohoCrmOrgCheck(env("off"))).toBe(false);
    expect(() =>
      assertZohoCrmLiveRequiresExpectedOrg({
        ZOHO_CRM_SYNC_MODE: "off",
        ZOHO_ARTWORK_LOCATION_MODE: "live",
      } as never),
    ).toThrow("zoho_crm_expected_org_type_required_for_live");
  });
});
