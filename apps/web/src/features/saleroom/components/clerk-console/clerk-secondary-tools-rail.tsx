"use client";

import type { ClerkLivePhase } from "@/features/saleroom/lib/clerk-live-phase";
import { resolveDefaultToolsTab } from "@/features/saleroom/lib/clerk-phase-layout";
import type {
  ClerkPhaseLayoutConfig,
  ClerkToolsRailSlots,
  ClerkToolsTab,
} from "@/features/saleroom/types/clerk-console.types";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@auction/ui/components/tabs";
import { cn } from "@auction/ui/lib/utils";
import { useEffect, useState } from "react";

const TOOLS_TABS: Array<{ id: ClerkToolsTab; label: string }> = [
  { id: "display", label: "Display" },
  { id: "telephone", label: "Telephone" },
  { id: "activity", label: "Activity" },
];

type Props = {
  phase: ClerkLivePhase;
  phaseLayout: ClerkPhaseLayoutConfig;
  pendingTelForLot: number;
  slots: ClerkToolsRailSlots;
};

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
      <div className="space-y-6">
        {slots.display}
        <div className="hidden lg:grid lg:grid-cols-2 lg:gap-6">
          {slots.telephone}
          {slots.activity}
        </div>
        <div className="lg:hidden">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ClerkToolsTab)}>
            <TabsList className="grid h-auto w-full grid-cols-2 gap-2 bg-transparent p-0">
              <TabsTrigger
                value="telephone"
                className="min-h-11 rounded-md font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] data-[state=active]:bg-primary data-[state=active]:text-on-primary"
              >
                Telephone
              </TabsTrigger>
              <TabsTrigger
                value="activity"
                className="min-h-11 rounded-md font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] data-[state=active]:bg-primary data-[state=active]:text-on-primary"
              >
                Activity
              </TabsTrigger>
            </TabsList>
            <TabsContent value="telephone" className="mt-4">
              {slots.telephone}
            </TabsContent>
            <TabsContent value="activity" className="mt-4">
              {slots.activity}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    );
  }

  return (
    <Tabs
      value={activeTab}
      onValueChange={(v) => setActiveTab(v as ClerkToolsTab)}
      className="space-y-4"
    >
      <TabsList className={cn("grid h-auto w-full gap-2 bg-transparent p-0", "grid-cols-3")}>
        {TOOLS_TABS.map((tab) => (
          <TabsTrigger
            key={tab.id}
            value={tab.id}
            className="min-h-11 rounded-md font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] data-[state=active]:bg-primary data-[state=active]:text-on-primary"
          >
            {tab.label}
            {tab.id === "telephone" && pendingTelForLot > 0 ? (
              <span className="ml-1.5 rounded-full bg-warning/20 px-1.5 py-0.5 text-[10px] text-warning">
                {pendingTelForLot}
              </span>
            ) : null}
          </TabsTrigger>
        ))}
      </TabsList>
      {TOOLS_TABS.map((tab) => (
        <TabsContent
          key={tab.id}
          value={tab.id}
          className="mt-0 rounded-lg border border-outline-variant/25 p-4"
        >
          {slots[tab.id]}
        </TabsContent>
      ))}
    </Tabs>
  );
}
