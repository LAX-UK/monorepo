import type { WorkerEnv } from "../../env.js";
import { getZohoCrmAccessToken } from "./oauth-token-refresh.js";

/**
 * After a failed lookup, how long the answer "not known" is kept before Zoho is asked again, so a
 * missing scope or an outage costs one call per this period, not one per Status write.
 */
export const ZOHO_CRM_USER_RETRY_MS = 15 * 60_000;

type Cache = { id: string } | { failedAtMs: number } | { pending: Promise<string | null> };

let cache: Cache | null = null;

/**
 * The Zoho CRM user id the worker's OAuth token acts as (the integration user), from
 * `GET /crm/v8/users?type=CurrentUser`. Asked once per process and kept: the token's user does not
 * change while the worker runs. Null when it cannot be told (not configured, the
 * `ZohoCRM.users.READ` scope missing, Zoho unreachable); callers then treat a change as anyone's.
 * Never throws.
 */
export async function zohoCrmIntegrationUserId(
  env: WorkerEnv,
  onFailure?: (reason: string) => void,
  nowMs: () => number = Date.now,
): Promise<string | null> {
  if (cache && "id" in cache) return cache.id;
  if (cache && "pending" in cache) return cache.pending;
  if (cache && "failedAtMs" in cache && nowMs() - cache.failedAtMs < ZOHO_CRM_USER_RETRY_MS) {
    return null;
  }
  const pending = lookUp(env).then(
    (id) => {
      cache = { id };
      return id;
    },
    (err: unknown) => {
      cache = { failedAtMs: nowMs() };
      onFailure?.(err instanceof Error ? err.message.slice(0, 200) : "unknown");
      return null;
    },
  );
  cache = { pending };
  return pending;
}

async function lookUp(env: WorkerEnv): Promise<string> {
  const token = await getZohoCrmAccessToken(env);
  if (!token) throw new Error("zoho_crm_not_configured");
  const url = new URL("/crm/v8/users", env.ZOHO_CRM_API_HOST);
  url.searchParams.set("type", "CurrentUser");
  const res = await fetch(url, { headers: { Authorization: `Zoho-oauthtoken ${token}` } });
  const text = await res.text();
  if (!res.ok) throw new Error(`zoho_current_user_failed_${res.status}:${text.slice(0, 200)}`);
  const json = JSON.parse(text) as { users?: Array<{ id?: unknown }> };
  const id = json.users?.[0]?.id;
  if (typeof id !== "string" || id.trim() === "") throw new Error("zoho_current_user_missing_id");
  return id.trim();
}

/** Test hook */
export function resetZohoCrmIntegrationUserForTests(): void {
  cache = null;
}
