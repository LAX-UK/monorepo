const LABELS: Record<string, string> = {
  "sale.created": "Sale created",
  "sale.published": "Sale published",
  "sale.unpublished": "Sale reverted to draft",
  "sale.cancelled": "Sale cancelled",
  "sale.ended": "Sale marked ended",
  "lot.voided": "Lot voided",
  "lot.withdrawal_requested": "Withdrawal requested",
  "bid.placed": "Bid placed",
  "bid.proxy_cancelled": "Proxy bid cancelled",
  "condition_report.requested": "Condition report requested",
  "condition_report.fulfilled": "Condition report fulfilled",
  "condition_report.declined": "Condition report declined",
  "category.created": "Category created",
  "category.updated": "Category updated",
  "category.archived": "Category archived",
  "category.deleted": "Category deleted",
};

export function domainEventLabel(eventType: string): string {
  if (LABELS[eventType]) return LABELS[eventType];
  const parts = eventType.split(".");
  const verb = parts[parts.length - 1] ?? eventType;
  return verb.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
