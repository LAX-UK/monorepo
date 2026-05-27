"use client";

import { Button } from "@auction/ui/components/button";
import { Landmark, UserRound } from "lucide-react";
import { SCENARIO_REGISTRY } from "./scenario-config";
import type { ArtistScenario } from "./types";

type Props = {
  value: ArtistScenario | null;
  onChange: (scenario: ArtistScenario) => void;
  disabled?: boolean;
};

const ICONS = {
  historical: Landmark,
  "maker-seller": UserRound,
} as const;

export function ScenarioSelector({ value, onChange, disabled = false }: Props) {
  return (
    <div className="space-y-3">
      <div>
        <p className="font-display text-lg font-semibold tracking-tight text-on-surface">
          What are you creating?
        </p>
        <p className="mt-1 text-sm text-on-surface-variant">
          Pick the path that matches attribution. You can change this before saving; switching paths
          may clear the linked user when moving to a catalogue-only profile.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {(Object.keys(SCENARIO_REGISTRY) as ArtistScenario[]).map((id) => {
          const cfg = SCENARIO_REGISTRY[id];
          const Icon = ICONS[id];
          const active = value === id;
          return (
            <Button
              key={id}
              type="button"
              variant="outline"
              disabled={disabled}
              onClick={() => onChange(id)}
              className={`flex h-auto min-h-0 flex-col items-start gap-3 rounded-2xl border p-4 text-left shadow-none transition-colors ${
                active
                  ? "border-primary bg-primary-container/30 ring-2 ring-primary/25"
                  : "border-outline-variant/40 bg-surface-container-lowest hover:border-primary/40"
              } disabled:cursor-not-allowed disabled:opacity-60`}
            >
              <span className="flex size-11 items-center justify-center rounded-full bg-surface-container-high text-primary">
                <Icon className="size-5" aria-hidden />
              </span>
              <span className="space-y-1">
                <span className="block font-display text-base font-semibold text-on-surface">
                  {cfg.label}
                </span>
                <span className="block text-sm text-on-surface-variant">{cfg.subtitle}</span>
                <span className="block font-label text-[10px] uppercase tracking-wide text-on-surface-variant/80">
                  {cfg.examples}
                </span>
              </span>
            </Button>
          );
        })}
      </div>
    </div>
  );
}
