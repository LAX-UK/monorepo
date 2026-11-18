import { crmErrorOutcome } from "../../../crm/classify-crm-error.js";
import { CrmGatewayError } from "../../../crm/crm-gateway-error.js";
import type { CrmSyncResult } from "../../../crm/crm-sync-result.js";
import type { ListingSyncReport } from "../listing/zoho-listing-sync.js";
import type { ZohoLocationSync } from "./zoho-location-sync.js";

export const ZOHO_LOCATION_EVENT_TYPE = "artwork_register.location_changed";

type LocationEvent = { eventType: string; aggregateId?: string; payload: unknown };

function registerIdOf(event: LocationEvent): string | null {
  const value = (event.payload as Record<string, unknown> | null)?.registerId;
  if (typeof value === "string" && value.length > 0) return value;
  return event.aggregateId ?? null;
}

/**
 * Refreshes `LAX_Location` for the artwork a location event names. Delivery is at least once and
 * in any order; that is safe because the value is read from LAX when the event is handled and
 * sent only when Zoho shows something else.
 */
export class ZohoLocationWriteback {
  constructor(
    private readonly deps: {
      sync: Pick<ZohoLocationSync, "sync">;
      mode: "dry_run" | "live";
    },
  ) {}

  async deliver(event: LocationEvent & { id?: number }): Promise<CrmSyncResult> {
    if (event.eventType !== ZOHO_LOCATION_EVENT_TYPE) {
      return { outcome: "skipped", reason: "event_type_not_handled" };
    }
    const registerId = registerIdOf(event);
    if (!registerId) return { outcome: "skipped", reason: "no_register_entry" };
    try {
      return this.outcome(await this.deps.sync.sync([registerId]));
    } catch (err) {
      const { retryable, error } = crmErrorOutcome(err);
      return retryable ? { outcome: "retry", error } : { outcome: "fatal", error };
    }
  }

  private outcome(report: ListingSyncReport): CrmSyncResult {
    const failed = report.failures[0];
    if (failed) {
      const error = new CrmGatewayError({
        code: failed.code,
        message: `LAX location not written for ${failed.stockCode ?? failed.registerId}`,
        status: failed.retryable ? 503 : 400,
        retryable: failed.retryable,
      });
      return failed.retryable ? { outcome: "retry", error } : { outcome: "fatal", error };
    }
    if (report.changed > 0) {
      return this.deps.mode === "dry_run"
        ? { outcome: "skipped", reason: "dry_run" }
        : { outcome: "success", providerReference: `Products:${report.changed}` };
    }
    if (report.checked === 0) return { outcome: "skipped", reason: "not_an_original" };
    return { outcome: "skipped", reason: "location_already_in_sync" };
  }
}
