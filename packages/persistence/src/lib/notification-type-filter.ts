/**
 * Inbox type filters that cover several notification types. Any other filter value is one type.
 */
const TYPE_FILTER_GROUPS: Readonly<Record<string, readonly string[]>> = {
  fulfilment: ["lot_ready_for_collection", "lot_shipped", "lot_delivered", "delivery_quote_ready"],
};

/** The notification types a type filter matches. */
export function notificationTypesForFilter(filter: string): readonly string[] {
  return TYPE_FILTER_GROUPS[filter] ?? [filter];
}
