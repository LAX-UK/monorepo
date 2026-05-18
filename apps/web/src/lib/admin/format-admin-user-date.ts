/** Fixed locale so SSR and client hydration match (avoid `undefined` → user OS locale). */
const ADMIN_USER_DATE_LOCALE = "en-GB";

/** Short date for admin user tables (joined / created). */
export function formatAdminUserDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(ADMIN_USER_DATE_LOCALE, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** Count rows created within the last N days (page-local KPI). */
export function countCreatedWithinDays(rows: { createdAt: string }[], days: number): number {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return rows.filter((r) => {
    const t = new Date(r.createdAt).getTime();
    return Number.isFinite(t) && t >= cutoff;
  }).length;
}
