/** Runs on the inbound webhook queue with the other nightly checks, so a failed pass lands on Failed jobs. */
export const REGISTER_LOT_INTEGRITY_JOB_NAME = "register-lot-integrity-check" as const;

/** 03:30 London time: after the Zoho checks at 02:30 and 03:00, so they have settled the catalogue. */
export const REGISTER_LOT_INTEGRITY_PATTERN = "30 3 * * *";
export const REGISTER_LOT_INTEGRITY_TIME_ZONE = "Europe/London";
