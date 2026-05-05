"use server";

import { DASHBOARD_DENSITY_COOKIE } from "@/lib/preferences/dashboard-density-cookie";
import type { DashboardDensity } from "@/lib/preferences/density";
import { cookies } from "next/headers";

export async function persistDashboardDensityCookieAction(
  density: DashboardDensity,
): Promise<void> {
  const jar = await cookies();
  jar.set(DASHBOARD_DENSITY_COOKIE, density, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    httpOnly: false,
  });
}
