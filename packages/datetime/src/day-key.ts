/** Calendar-day arithmetic on "YYYY-MM-DD" keys: plain string and UTC maths, no zone data. */

/** The day key `days` calendar days after `key` ("2026-11-03" plus 7 is "2026-11-10"). */
export function addCalendarKeyDays(key: string, days: number): string {
  return new Date(Date.parse(key) + days * 86_400_000).toISOString().slice(0, 10);
}
