"use client";

import { useShellConfig } from "@/lib/shell/shell-config-context";
import { cn } from "@auction/ui";

/** List row spacing from shell density (compact vs comfortable). */
export function useDashboardListDensityClass(): string {
  const { density } = useShellConfig();
  return density === "compact" ? "gap-2" : "gap-3";
}

export function dashboardListRowPaddingClass(density: "compact" | "normal" | undefined): string {
  return density === "compact" ? "py-3" : "py-4";
}

export function useDashboardListRowPaddingClass(): string {
  const { density } = useShellConfig();
  return cn(dashboardListRowPaddingClass(density));
}
