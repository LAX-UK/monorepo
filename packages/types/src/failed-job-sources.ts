/**
 * Where a failure comes from. Each source is one access scope: who may see its rows and who may
 * retry or discard them. Adding a source is one entry here and one row in the access table.
 */
export const FAILED_JOB_SOURCES = [
  "background_jobs",
  "integrations.xero",
  "integrations.zoho",
  "integrations.books",
  "integrations.other",
] as const;
export type FailedJobSource = (typeof FAILED_JOB_SOURCES)[number];
