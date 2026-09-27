import type { WorkerEnv } from "../../env.js";

export type ZohoCrmSyncMode = WorkerEnv["ZOHO_CRM_SYNC_MODE"];

/** When any identity person event is allowlisted, GDPR lifecycle events must still run. */
export const ZOHO_CRM_ALWAYS_ON_WHEN_PERSON_SYNC_EVENT_TYPES = [
  "user.deletion_requested",
  "user.deletion_cancelled",
  "user.identity_merged",
  "user.identity_deleted",
] as const;

export const ZOHO_CRM_PERSON_EVENT_TYPES = [
  "user.registered",
  "user.email_verified",
  "user.profile_updated",
  ...ZOHO_CRM_ALWAYS_ON_WHEN_PERSON_SYNC_EVENT_TYPES,
] as const;

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

export function hasZohoPersonSyncEnabled(env: WorkerEnv): boolean {
  const enabled = parseZohoEnabledEventTypes(env.ZOHO_CRM_ENABLED_EVENT_TYPES);
  return (
    enabled.has("user.registered") ||
    enabled.has("user.email_verified") ||
    enabled.has("user.profile_updated")
  );
}

export function resolveZohoDeliveryMode(env: WorkerEnv, eventType: string): ZohoDeliveryMode {
  if (env.ZOHO_CRM_SYNC_MODE === "off") return "off";
  if (!isZohoEventTypeEnabled(env, eventType)) return "disabled_type";
  if (env.ZOHO_CRM_SYNC_MODE === "dry_run") return "dry_run";
  if (env.ZOHO_CRM_SYNC_MODE === "canary" || env.ZOHO_CRM_SYNC_MODE === "live") {
    return env.ZOHO_CRM_SYNC_MODE;
  }
  return "off";
}

export function parseZohoEnabledEventTypes(raw: string | undefined): Set<string> {
  if (!raw || raw.trim() === "") return new Set();
  return new Set(
    raw
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0),
  );
}

export function isZohoEventTypeEnabled(env: WorkerEnv, eventType: string): boolean {
  const enabled = parseZohoEnabledEventTypes(env.ZOHO_CRM_ENABLED_EVENT_TYPES);
  if (enabled.size === 0) return false;
  if (enabled.has(eventType)) return true;
  if (
    hasZohoPersonSyncEnabled(env) &&
    (ZOHO_CRM_ALWAYS_ON_WHEN_PERSON_SYNC_EVENT_TYPES as readonly string[]).includes(eventType)
  ) {
    return true;
  }
  return false;
}
