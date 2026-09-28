import { describe, expect, it } from "vitest";
import type { WorkerEnv } from "../../env.js";
import { shouldRunZohoCrmOrgCheck } from "./zoho-crm-org-check.js";

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
