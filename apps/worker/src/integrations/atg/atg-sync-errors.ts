import { AtgGatewayError } from "./atg-gateway.js";

export function errorText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export function isRetryable(err: unknown): boolean {
  return err instanceof AtgGatewayError && err.retryable;
}

const MAX_LISTED_FAILURES = 5;

export function failureSummary(failures: string[]): string | null {
  if (failures.length === 0) return null;
  const listed = failures.slice(0, MAX_LISTED_FAILURES).join("; ");
  const more = failures.length - MAX_LISTED_FAILURES;
  return more > 0 ? `${listed}; +${more} more` : listed;
}
