import type { WorkerEnv } from "../../env.js";
import { isZohoEventTypeEnabled } from "./zoho-crm-allowlist-rules.js";

// The allowlist rules live in a module with no env import, so env.ts can run them at start-up
// without a circular import; they are re-exported here for the existing callers.
export {
  hasZohoPersonSyncEnabled,
  isZohoEventTypeEnabled,
  parseZohoEnabledEventTypes,
  ZOHO_CRM_ALWAYS_ON_WHEN_PERSON_SYNC_EVENT_TYPES,
  ZOHO_CRM_DEAL_EVENT_TYPES,
  ZOHO_CRM_PERSON_EVENT_TYPES,
  zohoCrmAllowlistIssues,
} from "./zoho-crm-allowlist-rules.js";

export type ZohoCrmSyncMode = WorkerEnv["ZOHO_CRM_SYNC_MODE"];

export function parseZohoCrmTrigger(raw: string | undefined): unknown[] {
  if (!raw || raw.trim() === "") return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export type ZohoDeliveryMode = "off" | "dry_run" | "canary" | "live" | "disabled_type";

export function resolveZohoDeliveryMode(env: WorkerEnv, eventType: string): ZohoDeliveryMode {
  if (env.ZOHO_CRM_SYNC_MODE === "off") return "off";
  if (!isZohoEventTypeEnabled(env, eventType)) return "disabled_type";
  if (env.ZOHO_CRM_SYNC_MODE === "dry_run") return "dry_run";
  if (env.ZOHO_CRM_SYNC_MODE === "canary" || env.ZOHO_CRM_SYNC_MODE === "live") {
    return env.ZOHO_CRM_SYNC_MODE;
  }
  return "off";
}
