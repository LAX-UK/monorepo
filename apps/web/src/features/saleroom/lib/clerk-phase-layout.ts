import type { ClerkLivePhase } from "@/features/saleroom/lib/clerk-live-phase";
import type { ClerkPhaseLayoutConfig } from "@/features/saleroom/types/clerk-console.types";

export const CLERK_PHASE_LAYOUT: Record<ClerkLivePhase, ClerkPhaseLayoutConfig> = {
  setup: {
    sessionBarMode: "full",
    toolsPresentation: "expanded",
    defaultToolsTab: "display",
    reserveDockSpace: false,
    stickySessionToolbar: false,
  },
  betweenLots: {
    sessionBarMode: "live",
    toolsPresentation: "tabbed",
    defaultToolsTab: "display",
    reserveDockSpace: true,
    stickySessionToolbar: true,
  },
  selling: {
    sessionBarMode: "live",
    toolsPresentation: "tabbed",
    defaultToolsTab: "display",
    reserveDockSpace: true,
    stickySessionToolbar: true,
  },
  paused: {
    sessionBarMode: "live",
    toolsPresentation: "tabbed",
    defaultToolsTab: "display",
    reserveDockSpace: true,
    stickySessionToolbar: true,
  },
};

export function resolveDefaultToolsTab(
  phase: ClerkLivePhase,
  pendingTelForLot: number,
): ClerkPhaseLayoutConfig["defaultToolsTab"] {
  if (pendingTelForLot > 0 && phase !== "setup") {
    return "telephone";
  }
  return CLERK_PHASE_LAYOUT[phase].defaultToolsTab;
}
