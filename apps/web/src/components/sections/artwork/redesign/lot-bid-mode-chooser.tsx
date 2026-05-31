"use client";

import type { LotBidEntryMode } from "@/lib/bid/lot-bid-entry-mode";
import { cn } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import { Gavel, Zap } from "lucide-react";

type Props = {
  mode: LotBidEntryMode;
  onModeChange: (mode: LotBidEntryMode) => void;
  disabled?: boolean;
  className?: string;
};

const MODES: {
  id: LotBidEntryMode;
  title: string;
  subtitle: string;
  icon: typeof Zap;
  recommended?: boolean;
}[] = [
  {
    id: "auto",
    title: "Auto-bid",
    subtitle: "Set your max. We bid the minimum needed to keep you in front, up to your max.",
    icon: Zap,
    recommended: true,
  },
  {
    id: "manual",
    title: "Place one bid now",
    subtitle: "Choose a single amount. You'll need to come back if another bidder goes higher.",
    icon: Gavel,
  },
];

export function LotBidModeChooser({ mode, onModeChange, disabled = false, className }: Props) {
  return (
    <fieldset className={cn("space-y-2 border-0 p-0", className)} aria-label="How to bid">
      <legend className="font-label text-xs font-bold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-surface-variant">
        How do you want to bid?
      </legend>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {MODES.map((m) => {
          const selected = mode === m.id;
          const Icon = m.icon;
          return (
            <Button
              key={m.id}
              type="button"
              variant="ghost"
              disabled={disabled}
              aria-pressed={selected}
              onClick={() => onModeChange(m.id)}
              className={cn(
                "flex flex-col items-start gap-2 rounded-lg border p-4 text-left transition-colors",
                selected
                  ? "border-primary bg-primary/10 ring-2 ring-primary/30"
                  : "border-outline-variant/40 bg-surface-container-lowest hover:border-primary/40 dark:bg-surface-container-low/40",
                disabled && "pointer-events-none opacity-60",
              )}
            >
              <span className="flex w-full items-center gap-2">
                <Icon
                  className={cn(
                    "size-4 shrink-0",
                    selected ? "text-primary" : "text-on-surface-variant",
                  )}
                  aria-hidden
                />
                <span
                  className={cn(
                    "font-label text-xs font-bold uppercase tracking-[var(--text-label-caps-tracking,0.22em)]",
                    selected ? "text-primary" : "text-on-surface",
                  )}
                >
                  {m.title}
                  {m.recommended ? (
                    <span className="ml-1.5 font-body text-[10px] font-normal normal-case text-on-surface-variant">
                      (recommended)
                    </span>
                  ) : null}
                </span>
              </span>
              <span className="font-body text-xs leading-relaxed text-on-surface-variant">
                {m.subtitle}
              </span>
            </Button>
          );
        })}
      </div>
    </fieldset>
  );
}
