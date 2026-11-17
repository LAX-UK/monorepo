import type { DeliveryView } from "@/lib/data/http/admin-deliveries.schema";
import { DELIVERY_QUOTE_DECLINE_REASON_MAX_LENGTH } from "@auction/domain";
import { DELIVERIES_COPY } from "./deliveries-copy";

const COPY = DELIVERIES_COPY.decline;

export const DECLINE_REASON_MAX = DELIVERY_QUOTE_DECLINE_REASON_MAX_LENGTH;

/**
 * Whether "Can't deliver" is offered (D5): Waiting for a price or Quote sent, for Fulfilment and
 * Administrators only. The API decides again on submit.
 */
export function canDeclineDelivery(
  row: Pick<DeliveryView, "status" | "quote"> | null,
  canWork: boolean,
): row is Pick<DeliveryView, "status" | "quote"> {
  if (!row || !canWork) return false;
  return (
    (row.status === "waiting" && row.quote.status === "requested") ||
    (row.status === "quoted" && row.quote.status === "quoted")
  );
}

/** The one field's message, or null when the reason can be sent (the API's own limits). */
export function validateDeclineReason(reason: string): string | null {
  const trimmed = reason.trim();
  if (trimmed.length === 0) return COPY.reasonMissing;
  if (trimmed.length > DECLINE_REASON_MAX) return COPY.reasonTooLong(DECLINE_REASON_MAX);
  return null;
}

/** The request moved on under the dialog (D6): show the stale Notice and reload the panel. */
export function isStaleDecline(code: string | undefined): boolean {
  return code === "quote_changed" || code === "quote_step_not_allowed";
}

/** The sentence for a failed decline. Stale codes have their own Notice, so they are not here. */
export function deliveryDeclineErrorMessage(
  code: string | undefined,
  status: number | undefined,
): string {
  if (code && isStaleDecline(code)) return COPY.stale.title;
  if (status === 403) return COPY.errors.forbidden;
  if (status === 404 || code === "purchase_not_found") return COPY.errors.notFound;
  if (status === 400 || status === 422) return COPY.errors.invalid;
  return COPY.errors.unavailable;
}
