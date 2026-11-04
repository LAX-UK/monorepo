import { afterEach, describe, expect, it, vi } from "vitest";
import type { WorkerEnv } from "../../env.js";
import {
  assertZohoCrmLiveRequiresExpectedOrg,
  shouldRunZohoCrmOrgCheck,
} from "./zoho-crm-org-check.js";

function env(partial: Partial<WorkerEnv>): WorkerEnv {
  return partial as WorkerEnv;
}

describe("shouldRunZohoCrmOrgCheck", () => {
  it("skips dry_run and off", () => {
    expect(shouldRunZohoCrmOrgCheck(env({ ZOHO_CRM_SYNC_MODE: "dry_run" }))).toBe(false);
    expect(shouldRunZohoCrmOrgCheck(env({ ZOHO_CRM_SYNC_MODE: "off" }))).toBe(false);
  });

  it("runs for live/canary when expected org type set", () => {
    expect(
      shouldRunZohoCrmOrgCheck(
        env({ ZOHO_CRM_SYNC_MODE: "live", ZOHO_CRM_EXPECTED_ORG_TYPE: "sandbox" }),
      ),
    ).toBe(true);
  });
});

describe("artwork writeback live mode", () => {
  it("is checked like the CRM sync, only when live", () => {
    const base = { ZOHO_CRM_SYNC_MODE: "off", ZOHO_CRM_EXPECTED_ORG_TYPE: "production" } as const;
    expect(shouldRunZohoCrmOrgCheck(env({ ...base, ZOHO_ARTWORK_WRITEBACK_MODE: "live" }))).toBe(
      true,
    );
    expect(shouldRunZohoCrmOrgCheck(env({ ...base, ZOHO_ARTWORK_WRITEBACK_MODE: "dry_run" }))).toBe(
      false,
    );
    expect(shouldRunZohoCrmOrgCheck(env({ ...base, ZOHO_ARTWORK_WRITEBACK_MODE: "off" }))).toBe(
      false,
    );
  });

  it("refuses to start live without an expected org", () => {
    expect(() =>
      assertZohoCrmLiveRequiresExpectedOrg(
        env({ ZOHO_CRM_SYNC_MODE: "off", ZOHO_ARTWORK_WRITEBACK_MODE: "live" }),
      ),
    ).toThrow("zoho_crm_expected_org_type_required_for_live");
    expect(() =>
      assertZohoCrmLiveRequiresExpectedOrg(
        env({ ZOHO_CRM_SYNC_MODE: "off", ZOHO_ARTWORK_WRITEBACK_MODE: "dry_run" }),
      ),
    ).not.toThrow();
  });
});

describe("assertZohoCrmOrgEnvironment for the writeback", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  async function run(orgType: string, expected: "sandbox" | "production") {
    vi.doMock("./oauth-token-refresh.js", () => ({ getZohoCrmAccessToken: async () => "t" }));
    vi.resetModules();
    const mod = await import("./zoho-crm-org-check.js");
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () => new Response(JSON.stringify({ org: [{ type: orgType }] }), { status: 200 }),
      ),
    );
    return mod.assertZohoCrmOrgEnvironment(
      env({
        ZOHO_CRM_SYNC_MODE: "off",
        ZOHO_ARTWORK_WRITEBACK_MODE: "live",
        ZOHO_CRM_EXPECTED_ORG_TYPE: expected,
        ZOHO_CRM_API_HOST: "https://www.zohoapis.eu",
      }),
    );
  }

  it("refuses a sandbox org when production is expected", async () => {
    await expect(run("sandbox", "production")).rejects.toThrow("zoho_org_environment_mismatch");
  });

  it("refuses a production org when sandbox is expected", async () => {
    await expect(run("production", "sandbox")).rejects.toThrow("zoho_org_environment_mismatch");
  });

  it("accepts the expected org", async () => {
    await expect(run("production", "production")).resolves.toBeUndefined();
    await expect(run("sandbox", "sandbox")).resolves.toBeUndefined();
  });
});
