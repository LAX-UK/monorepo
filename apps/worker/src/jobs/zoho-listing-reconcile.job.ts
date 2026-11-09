/** Runs on the inbound webhook queue, so a failed pass lands on Failed jobs with the rest. */
export const ZOHO_LISTING_NIGHTLY_JOB_NAME = "zoho-listing-nightly-check" as const;

/** 03:00 London time: after the inbound check at 02:30, so both see the same catalogue. */
export const ZOHO_LISTING_NIGHTLY_PATTERN = "0 3 * * *";
export const ZOHO_LISTING_NIGHTLY_TIME_ZONE = "Europe/London";

/** Refreshes the listings of sales that have just started on their own time. */
export const ZOHO_LISTING_SALE_START_JOB_NAME = "zoho-listing-sale-start-check" as const;
export const ZOHO_LISTING_SALE_START_PATTERN = "*/15 * * * *";
/** Key of this job's Sentry cron monitor in SENTRY_MONITOR_SLUGS. */
export const ZOHO_LISTING_SALE_START_MONITOR_KEY = "zoho-listing-sale-start";
