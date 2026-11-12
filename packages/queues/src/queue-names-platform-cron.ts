export const LOT_LIFECYCLE_TICK_QUEUE_NAME = "lot-lifecycle-tick" as const;
export const PROCESS_NOTIFICATION_OUTBOX_QUEUE_NAME = "process-notification-outbox" as const;
export const STALE_SUBMISSION_DRAFT_REMINDERS_QUEUE_NAME =
  "stale-submission-draft-reminders" as const;
export const CONSIGNMENT_AGREEMENT_REMINDERS_QUEUE_NAME =
  "consignment-agreement-reminders" as const;
export const PAYMENT_REMINDERS_QUEUE_NAME = "payment-reminders" as const;
export const WATCHED_LOT_REMINDERS_QUEUE_NAME = "watched-lot-reminders" as const;
export const COLLECTION_REMINDERS_QUEUE_NAME = "collection-reminders" as const;
export const REOFFER_SWEEP_QUEUE_NAME = "reoffer-sweep" as const;
export const STAFF_ROLE_EXPIRY_QUEUE_NAME = "staff-role-expiry" as const;
/** Daily check for settled private sales whose artwork the register does not show as sold. */
export const PRIVATE_SALE_SETTLEMENT_FOLLOW_UPS_QUEUE_NAME =
  "private-sale-settlement-follow-ups" as const;
export const CONSIGNMENT_THREAD_SWEEP_QUEUE_NAME = "consignment-thread-sweep" as const;
export const SHOP_STOCK_RECONCILIATION_QUEUE_NAME = "shop-stock-reconciliation" as const;
/** Refreshes the Zoho listing of lots whose sale has just started on its own time. */
export const ZOHO_LISTING_SALE_START_QUEUE_NAME = "zoho-listing-sale-start" as const;
