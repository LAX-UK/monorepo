import { crmErrorOutcome } from "../../crm/classify-crm-error.js";
import type { CrmSyncResult } from "../../crm/crm-sync-result.js";
import { type FulfilmentEvent, fulfilmentTriggerOf } from "./fulfilment-triggers.js";
import type { OrderMirror } from "./order-mirror.js";
import type { PrintGroupMirror } from "./print-group-mirror.js";

/**
 * Hears the fulfilment events and brings the work each one is about into line in Zoho: the print
 * group for a listing event, the order's prints, framing and dispatch for an order event. Delivery is at least once and in any order, which is safe because each unit works from the state
 * LAX and Zoho are in when it runs.
 */
export class ZohoFulfilmentMirror {
  constructor(
    private readonly deps: {
      groups: Pick<PrintGroupMirror, "deliver">;
      orders: Pick<OrderMirror, "deliver">;
    },
  ) {}

  async deliver(event: FulfilmentEvent & { id?: number }): Promise<CrmSyncResult> {
    const trigger = fulfilmentTriggerOf(event);
    if (!trigger) return { outcome: "skipped", reason: "event_type_not_handled" };
    try {
      return trigger.kind === "group"
        ? await this.deps.groups.deliver(trigger.artworkId)
        : await this.deps.orders.deliver(trigger.orderId, {
            reportProblems: trigger.reportsProblems,
          });
    } catch (err) {
      const { retryable, error } = crmErrorOutcome(err);
      return retryable ? { outcome: "retry", error } : { outcome: "fatal", error };
    }
  }
}
