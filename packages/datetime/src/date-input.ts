/** A date, a timestamp, or an ISO string, as the API and view models hand them over. */
export type DateInput = Date | string | number;

/** Parses the input; `null` when it is not a real instant, so callers can hide the line. */
export function toDate(input: DateInput | null | undefined): Date | null {
  if (input == null || input === "") return null;
  const date = input instanceof Date ? input : new Date(input);
  return Number.isNaN(date.getTime()) ? null : date;
}
