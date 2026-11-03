import { formatStaffDate } from "@auction/staff-ui";

/** Short date for admin user tables (joined / created): "30 Sep 2026". */
export function formatAdminUserDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return formatStaffDate(d);
}

/** Count rows created within the last N days (page-local KPI). */
export function countCreatedWithinDays(rows: { createdAt: string }[], days: number): number {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return rows.filter((r) => {
    const t = new Date(r.createdAt).getTime();
    return Number.isFinite(t) && t >= cutoff;
  }).length;
}
