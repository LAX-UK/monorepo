import type { WorkerEnv } from "../../env.js";
import { getZohoCrmAccessToken } from "./oauth-token-refresh.js";
import { ZohoCrmAuthError } from "./types.js";

/** Org check runs only for canary/live (not off or dry_run). */
export function shouldRunZohoCrmOrgCheck(env: WorkerEnv): boolean {
  const mode = env.ZOHO_CRM_SYNC_MODE;
  if (mode === "off" || mode === "dry_run") return false;
  return Boolean(env.ZOHO_CRM_EXPECTED_ORG_TYPE);
}

export function assertZohoCrmLiveRequiresExpectedOrg(env: WorkerEnv): void {
  const mode = env.ZOHO_CRM_SYNC_MODE;
  if ((mode === "live" || mode === "canary") && !env.ZOHO_CRM_EXPECTED_ORG_TYPE) {
    throw new ZohoCrmAuthError("zoho_crm_expected_org_type_required_for_live");
  }
}

export async function assertZohoCrmOrgEnvironment(env: WorkerEnv): Promise<void> {
  assertZohoCrmLiveRequiresExpectedOrg(env);
  const expected = env.ZOHO_CRM_EXPECTED_ORG_TYPE;
  if (!shouldRunZohoCrmOrgCheck(env) || !expected) return;

  const token = await getZohoCrmAccessToken(env);
  if (!token) {
    throw new ZohoCrmAuthError("zoho_crm_not_configured");
  }

  const url = new URL("/crm/v8/org", env.ZOHO_CRM_API_HOST);
  const res = await fetch(url, {
    headers: { Authorization: `Zoho-oauthtoken ${token}` },
  });
  const text = await res.text();
  if (!res.ok) {
    throw new ZohoCrmAuthError(`zoho_org_check_failed_${res.status}:${text.slice(0, 200)}`);
  }

  let json: { org?: Array<{ type?: string; environment?: string }> };
  try {
    json = JSON.parse(text) as typeof json;
  } catch {
    throw new ZohoCrmAuthError("zoho_org_check_invalid_json");
  }

  const orgType = (json.org?.[0]?.type ?? json.org?.[0]?.environment ?? "").toLowerCase();
  const expectedNorm = expected.toLowerCase();
  if (
    !orgType.includes(expectedNorm) &&
    expectedNorm === "sandbox" &&
    !orgType.includes("sandbox")
  ) {
    throw new ZohoCrmAuthError(
      `zoho_org_environment_mismatch:expected=${expected},actual=${orgType}`,
    );
  }
  if (expectedNorm === "production" && orgType.includes("sandbox")) {
    throw new ZohoCrmAuthError(
      `zoho_org_environment_mismatch:expected=${expected},actual=${orgType}`,
    );
  }
}
