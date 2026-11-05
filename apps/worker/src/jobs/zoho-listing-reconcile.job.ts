/** Runs on the inbound webhook queue, so a failed pass lands on Failed jobs with the rest. */
export const ZOHO_LISTING_NIGHTLY_JOB_NAME = "zoho-listing-nightly-check" as const;

/** 03:00 London time: after the inbound check at 02:30, so both see the same catalogue. */
export const ZOHO_LISTING_NIGHTLY_PATTERN = "0 3 * * *";
export const ZOHO_LISTING_NIGHTLY_TIME_ZONE = "Europe/London";
