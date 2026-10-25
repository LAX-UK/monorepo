import { formatStaffDay } from "@auction/staff-ui";

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** A date of birth as staff read dates ("12 Mar 1984"); anything else is shown as given. */
export function formatBirthDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const day = value.slice(0, 10);
  return DAY.test(day) ? formatStaffDay(day) : value;
}
