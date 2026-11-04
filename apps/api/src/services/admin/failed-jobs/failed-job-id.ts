import { FAILED_JOB_ID_PREFIXES } from "@auction/types";

/**
 * The id a screen uses for a failed background job: the store's id behind a `job:` prefix. Ids
 * without a prefix are older links, and still mean a background job.
 */
export function backgroundJobScreenId(storeId: string): string {
  return `${FAILED_JOB_ID_PREFIXES.job}${storeId}`;
}

export function isBackgroundJobScreenId(id: string): boolean {
  return (
    !id.startsWith(FAILED_JOB_ID_PREFIXES.delivery) &&
    !id.startsWith(FAILED_JOB_ID_PREFIXES.webhook)
  );
}

/** The store's id for a background job id as the screen sends it. */
export function backgroundJobStoreId(screenId: string): string {
  return screenId.startsWith(FAILED_JOB_ID_PREFIXES.job)
    ? screenId.slice(FAILED_JOB_ID_PREFIXES.job.length)
    : screenId;
}

export function isIntegrationScreenId(id: string): boolean {
  return !isBackgroundJobScreenId(id);
}
