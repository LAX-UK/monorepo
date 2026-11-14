/**
 * The status a download of one client record (an invoice, an agreement, a calendar file) answers
 * with when the API refuses it. "Not yours" and "not there" read the same, so another person's
 * record is never confirmed to exist; an API that failed is "unavailable", not the record's fault.
 */
export function recordRefusalStatus(apiStatus: number | null): number {
  if (apiStatus === null || apiStatus >= 500) return 503;
  if (apiStatus === 403) return 404;
  return apiStatus;
}
