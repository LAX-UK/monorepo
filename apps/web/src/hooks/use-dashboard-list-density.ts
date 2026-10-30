"use client";

import type { DashboardDensity } from "@/lib/preferences/density";
import { useOptionalShellConfig } from "@/lib/shell/shell-config-context";
import { cn } from "@auction/ui";

/**
 * The density the surrounding frame asks lists for. The public site and staff frames provide a
 * shell config; the organisation workspace has none and lists keep their comfortable spacing, so
 * a list renders the same in any frame instead of failing outside one.
 */
function useListDensity(): DashboardDensity | undefined {
  return useOptionalShellConfig()?.density;
}

/** List row spacing from shell density (compact vs comfortable). */
export function useDashboardListDensityClass(): string {
  return useListDensity() === "compact" ? "gap-2" : "gap-3";
}

export function dashboardListRowPaddingClass(density: DashboardDensity | undefined): string {
  return density === "compact" ? "py-3" : "py-4";
}

export function useDashboardListRowPaddingClass(): string {
  return cn(dashboardListRowPaddingClass(useListDensity()));
}
