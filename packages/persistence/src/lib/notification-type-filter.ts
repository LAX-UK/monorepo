/**
 * Inbox type filters that cover several notification types, as the Notifications page's Filter
 * offers them. Any other filter value is one type.
 */
const TYPE_FILTER_GROUPS: Readonly<Record<string, readonly string[]>> = {
  outbid: ["outbid", "bid_refused_limit"],
  payments: ["payment_due", "payment_received", "payout_problem", "payout_bank_changed"],
  fulfilment: ["lot_ready_for_collection", "lot_shipped", "lot_delivered", "delivery_quote_ready"],
  closing_soon: ["lot_ending_soon", "watchlist_ending_soon"],
  watching: ["watchlist_starting", "watchlist_ending_soon"],
  consignments: [
    "submission_received_for_review",
    "submission_approved",
    "submission_rejected",
    "submission_converted",
    "submission_draft_reminder",
    "submission_changes_requested",
    "consignment_agreement_reminder",
    "consignment_update",
    "consignment_message",
    "lot_ended_seller",
    "condition_report_ready",
    "condition_report_declined",
  ],
  team: ["access_requested", "access_request_decided", "organisation_member_left"],
};

/** The notification types a type filter matches. */
export function notificationTypesForFilter(filter: string): readonly string[] {
  return TYPE_FILTER_GROUPS[filter] ?? [filter];
}
