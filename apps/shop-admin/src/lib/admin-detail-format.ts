import { formatStaffDateTime } from "@auction/staff-ui";

export function formatAdminDetailGbpPence(pence: number): string {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(pence / 100);
}

/** The one staff date style, always London time, so server and browser render the same text. */
export function formatAdminDetailDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return formatStaffDateTime(date);
}
