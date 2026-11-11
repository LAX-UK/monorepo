import { ZOHO_LISTING_SALE_START_QUEUE_NAME } from "@auction/queues";

/** Runs on the inbound webhook queue, so a failed pass lands on Failed jobs with the rest. */
export const ZOHO_LISTING_NIGHTLY_JOB_NAME = "zoho-listing-nightly-check" as const;

/** 03:00 London time: after the inbound check at 02:30, so both see the same catalogue. */
export const ZOHO_LISTING_NIGHTLY_PATTERN = "0 3 * * *";
export const ZOHO_LISTING_NIGHTLY_TIME_ZONE = "Europe/London";

/**
 * The nightly Zoho Status check on its own, for when the listing is off. With the listing on, its
 * nightly pass runs the Status check as well, so this job is not scheduled then. It is what turns
 * Withdrawn back into Available after 30 days, which no register event does.
 */
export const ZOHO_STATUS_NIGHTLY_JOB_NAME = "zoho-status-nightly-check" as const;
export const ZOHO_STATUS_NIGHTLY_PATTERN = "15 3 * * *";

/**
 * Refreshes the listings of sales that have just started on their own time. Runs on its own queue
 * (`ZOHO_LISTING_SALE_START_QUEUE_NAME`) so it never holds up inbound webhooks.
 */
export const ZOHO_LISTING_SALE_START_JOB_NAME = "zoho-listing-sale-start-check" as const;
/** Key of this job's Sentry cron monitor in SENTRY_MONITOR_SLUGS (the queue name, like the other cron jobs). */
export const ZOHO_LISTING_SALE_START_MONITOR_KEY = ZOHO_LISTING_SALE_START_QUEUE_NAME;
