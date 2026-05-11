"use client";

import { Badge } from "@auction/ui/components/badge";
import { SCENARIO_REGISTRY } from "./scenario-config";
import type { ArtistScenario } from "./types";

type Props = {
  scenario: ArtistScenario;
};

/** Read-only scenario indicator on edit (cannot change path without recreate). */
export function ArtistScenarioBadge({ scenario }: Props) {
  const cfg = SCENARIO_REGISTRY[scenario];
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-outline-variant/30 bg-surface-container-low/40 px-4 py-3">
      <span className="text-sm text-on-surface-variant">Profile type</span>
      <Badge variant={scenario === "maker-seller" ? "secondary" : "outline"}>{cfg.label}</Badge>
      <span className="text-xs text-on-surface-variant">{cfg.subtitle}</span>
    </div>
  );
}
