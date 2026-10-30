"use client";

import type { ClerkLivePhase } from "@/features/saleroom/lib/clerk-live-phase";
import { resolveDefaultToolsTab } from "@/features/saleroom/lib/clerk-phase-layout";
import type {
  ClerkPhaseLayoutConfig,
  ClerkToolsRailSlots,
  ClerkToolsTab,
} from "@/features/saleroom/types/clerk-console.types";
import { SegmentedControl } from "@auction/staff-ui";
import { useEffect, useState } from "react";

type Props = {
  phase: ClerkLivePhase;
  phaseLayout: ClerkPhaseLayoutConfig;
  pendingTelForLot: number;
  slots: ClerkToolsRailSlots;
};

/**
 * The tools beside the lot controls: the venue display, telephone lines and the activity log.
 * Before the sale they show together; once it runs they sit behind one switch so the lot controls
 * stay in view, and the telephone tab comes forward when a line is waiting.
 */
export function ClerkSecondaryToolsRail({ phase, phaseLayout, pendingTelForLot, slots }: Props) {
  const defaultTab = resolveDefaultToolsTab(phase, pendingTelForLot);
  const [activeTab, setActiveTab] = useState<ClerkToolsTab>(defaultTab);

  useEffect(() => {
    if (pendingTelForLot > 0 && phase !== "setup") {
      setActiveTab("telephone");
    }
  }, [pendingTelForLot, phase]);

  if (phaseLayout.toolsPresentation === "expanded") {
    return (
      <div className="flex flex-col gap-6">
        {slots.display}
        <div className="grid grid-cols-2 items-start gap-6">
          {slots.telephone}
          {slots.activity}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <SegmentedControl<ClerkToolsTab>
        label="Console tools"
        size="md"
        value={activeTab}
        onValueChange={setActiveTab}
        options={[
          { value: "display", label: "Display" },
          {
            value: "telephone",
            label: pendingTelForLot > 0 ? `Telephone (${pendingTelForLot} waiting)` : "Telephone",
          },
          { value: "activity", label: "Activity" },
        ]}
      />
      <div className="rounded-staff-lg border border-staff-line bg-staff-surface p-4">
        {slots[activeTab]}
      </div>
    </div>
  );
}
