import { crmErrorOutcome } from "../../crm/classify-crm-error.js";
import type { CrmSyncResult } from "../../crm/crm-sync-result.js";
import { type FulfilmentEvent, fulfilmentTriggerOf } from "./fulfilment-triggers.js";
import type { PrintGroupMirror } from "./print-group-mirror.js";

/**
 * Hears the fulfilment events and brings the work each one is about into line in Zoho. Today that
 * is the print group; the order's print lines follow and are answered as skipped until then.
 * Delivery is at least once and in any order, which is safe because each unit works from the state
 * LAX and Zoho are in when it runs.
 */
export class ZohoFulfilmentMirror {
  constructor(private readonly deps: { groups: Pick<PrintGroupMirror, "deliver"> }) {}

  async deliver(event: FulfilmentEvent & { id?: number }): Promise<CrmSyncResult> {
    const trigger = fulfilmentTriggerOf(event);
    if (!trigger) return { outcome: "skipped", reason: "event_type_not_handled" };
    if (trigger.kind === "order") return { outcome: "skipped", reason: "order_mirror_not_built" };
    try {
      return await this.deps.groups.deliver(trigger.artworkId);
    } catch (err) {
      const { retryable, error } = crmErrorOutcome(err);
      return retryable ? { outcome: "retry", error } : { outcome: "fatal", error };
    }
  }
}
