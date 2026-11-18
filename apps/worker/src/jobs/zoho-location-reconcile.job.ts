/** Runs on the inbound webhook queue, so a failed pass lands on Failed jobs with the rest. */
export const ZOHO_LOCATION_NIGHTLY_JOB_NAME = "zoho-location-nightly-check" as const;

/** 03:30 London time: after the listing and Status checks, so the passes do not overlap. */
export const ZOHO_LOCATION_NIGHTLY_PATTERN = "30 3 * * *";
export const ZOHO_LOCATION_NIGHTLY_TIME_ZONE = "Europe/London";
