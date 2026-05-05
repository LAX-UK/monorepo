import type { DashboardDensity } from "@/lib/preferences/density";

export const DASHBOARD_DENSITY_COOKIE = "lax_dashboard_density";

export function parseDashboardDensityCookie(raw: string | undefined): DashboardDensity | null {
  if (raw === "compact" || raw === "normal") return raw;
  return null;
}
