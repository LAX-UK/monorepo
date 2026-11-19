import { listDomainEventTypesForConsumer } from "@auction/types";
import type { WorkerEnv } from "../../env.js";

export type ZohoCrmSyncMode = WorkerEnv["ZOHO_CRM_SYNC_MODE"];

/** When any identity person event is allowlisted, GDPR lifecycle events must still run. */
export const ZOHO_CRM_ALWAYS_ON_WHEN_PERSON_SYNC_EVENT_TYPES = [
  "user.deletion_requested",
  "user.deletion_cancelled",
  "user.identity_merged",
  "user.identity_deleted",
] as const;

/**
 * An erasure always runs where the records it removes were synced: a guest lead's erasure is on
 * whenever guest leads are sent to the CRM, whatever the allowlist says. Enquiries create leads
 * too, so an account purge and a guest erasure also run whenever enquiries are sent.
 */
const ERASURE_FOLLOWS_SYNC: Readonly<Record<string, readonly string[]>> = {
  "shop.guest_lead.erased": ["shop.guest_lead.recorded", "marketing_enquiry.received"],
  "user.identity_deleted": ["marketing_enquiry.received"],
};

export const ZOHO_CRM_PERSON_EVENT_TYPES = [
  "user.registered",
  "user.email_verified",
  "user.profile_updated",
  ...ZOHO_CRM_ALWAYS_ON_WHEN_PERSON_SYNC_EVENT_TYPES,
] as const;

/** The deal stage each deal event type writes; the pipeline is needed with it. */
const ZOHO_CRM_DEAL_STAGE_SETTING = {
  "bid.lot_won": "ZOHO_CRM_DEAL_STAGE_LOT_WON",
  "payment.captured": "ZOHO_CRM_DEAL_STAGE_PAYMENT_CAPTURED",
  "payment.refunded": "ZOHO_CRM_DEAL_STAGE_PAYMENT_REFUNDED",
  "shop.order.paid": "ZOHO_CRM_DEAL_STAGE_SHOP_PAID",
  "shop.refund.completed": "ZOHO_CRM_DEAL_STAGE_PAYMENT_REFUNDED",
} as const satisfies Record<string, keyof WorkerEnv>;

/** Event types that write a person's Deals, or the notes on them. */
export const ZOHO_CRM_DEAL_EVENT_TYPES = [
  ...(Object.keys(ZOHO_CRM_DEAL_STAGE_SETTING) as (keyof typeof ZOHO_CRM_DEAL_STAGE_SETTING)[]),
  "shop.fulfilment.status_changed",
] as const;

type ZohoCrmAllowlistSettings = Pick<
  WorkerEnv,
  | "ZOHO_CRM_ENABLED_EVENT_TYPES"
  | "ZOHO_CRM_AUCTION_PIPELINE"
  | (typeof ZOHO_CRM_DEAL_STAGE_SETTING)[keyof typeof ZOHO_CRM_DEAL_STAGE_SETTING]
>;

/**
 * What is wrong with the CRM allowlist, checked at start-up: a type the CRM consumer does not
 * receive (a typo), a deal type without its pipeline and stage (every event would be skipped), or
 * a deal type on while the erasure that removes those deals is off.
 */
export function zohoCrmAllowlistIssues(settings: ZohoCrmAllowlistSettings): string[] {
  const enabled = parseZohoEnabledEventTypes(settings.ZOHO_CRM_ENABLED_EVENT_TYPES);
  const known = new Set<string>(listDomainEventTypesForConsumer("zoho"));
  const issues: string[] = [];
  const unknown = [...enabled].filter((type) => !known.has(type));
  if (unknown.length > 0) {
    issues.push(`ZOHO_CRM_ENABLED_EVENT_TYPES lists unknown event types: ${unknown.join(", ")}`);
  }
  for (const [type, stageSetting] of Object.entries(ZOHO_CRM_DEAL_STAGE_SETTING)) {
    if (!enabled.has(type)) continue;
    const missing = (["ZOHO_CRM_AUCTION_PIPELINE", stageSetting] as const).filter(
      (key) => !settings[key].trim(),
    );
    if (missing.length > 0) issues.push(`${missing.join(", ")} required when ${type} is enabled`);
  }
  const dealTypes = ZOHO_CRM_DEAL_EVENT_TYPES.filter((type) => enabled.has(type));
  if (dealTypes.length > 0 && !isZohoEventTypeEnabled(settings, "user.identity_deleted")) {
    issues.push(
      `user.identity_deleted must be enabled when ${dealTypes.join(", ")} is enabled, so erasure removes those deals and notes`,
    );
  }
  return issues;
}

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

export function hasZohoPersonSyncEnabled(
  env: Pick<WorkerEnv, "ZOHO_CRM_ENABLED_EVENT_TYPES">,
): boolean {
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

export function isZohoEventTypeEnabled(
  env: Pick<WorkerEnv, "ZOHO_CRM_ENABLED_EVENT_TYPES">,
  eventType: string,
): boolean {
  const enabled = parseZohoEnabledEventTypes(env.ZOHO_CRM_ENABLED_EVENT_TYPES);
  if (enabled.size === 0) return false;
  if (enabled.has(eventType)) return true;
  const sentBy = ERASURE_FOLLOWS_SYNC[eventType];
  if (sentBy?.some((syncedType) => enabled.has(syncedType))) return true;
  if (
    hasZohoPersonSyncEnabled(env) &&
    (ZOHO_CRM_ALWAYS_ON_WHEN_PERSON_SYNC_EVENT_TYPES as readonly string[]).includes(eventType)
  ) {
    return true;
  }
  return false;
}
