import type { WorkerEnv } from "../../env.js";

export type ZohoCrmSyncMode = WorkerEnv["ZOHO_CRM_SYNC_MODE"];

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
  return enabled.has(eventType);
}

export function shouldPerformZohoHttp(env: WorkerEnv, eventType: string): boolean {
  if (env.ZOHO_CRM_SYNC_MODE === "off") return false;
  if (!isZohoEventTypeEnabled(env, eventType)) return false;
  return env.ZOHO_CRM_SYNC_MODE === "live" || env.ZOHO_CRM_SYNC_MODE === "canary";
}

export function shouldLogZohoDryRun(env: WorkerEnv, eventType: string): boolean {
  if (env.ZOHO_CRM_SYNC_MODE === "off") return false;
  if (!isZohoEventTypeEnabled(env, eventType)) return false;
  return env.ZOHO_CRM_SYNC_MODE === "dry_run" || env.ZOHO_CRM_SYNC_MODE === "canary";
}
