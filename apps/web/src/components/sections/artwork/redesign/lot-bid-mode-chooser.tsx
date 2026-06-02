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
}[] = [
  {
    id: "auto",
    title: "Auto-bid",
    subtitle: "Set your max. We bid the minimum needed to keep you in front, up to your max.",
    icon: Zap,
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
      <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2 [&>*]:min-w-0">
        {MODES.map((m) => {
          const selected = mode === m.id;
          const Icon = m.icon;
          return (
            <Button
              key={m.id}
              type="button"
              variant="ghost"
              size="link"
              disabled={disabled}
              aria-pressed={selected}
              onClick={() => onModeChange(m.id)}
              className={cn(
                "flex h-auto min-h-0 w-full min-w-0 flex-col items-start justify-start gap-2 whitespace-normal rounded-lg border p-4 text-left shadow-none transition-colors",
                selected
                  ? "border-primary bg-primary/10 ring-2 ring-primary/30"
                  : "border-outline-variant/40 bg-surface-container-lowest hover:border-primary/40 dark:bg-surface-container-low/40",
                disabled && "pointer-events-none opacity-60",
              )}
            >
              <span className="flex w-full min-w-0 items-center gap-2">
                <Icon
                  className={cn(
                    "size-4 shrink-0",
                    selected ? "text-primary" : "text-on-surface-variant",
                  )}
                  aria-hidden
                />
                <span
                  className={cn(
                    "min-w-0 flex-1 break-words font-label text-xs font-bold uppercase tracking-[var(--text-label-caps-tracking,0.22em)]",
                    selected ? "text-primary" : "text-on-surface",
                  )}
                >
                  {m.title}
                </span>
              </span>
              <span className="block w-full min-w-0 break-words font-body text-xs leading-relaxed text-on-surface-variant">
                {m.subtitle}
              </span>
            </Button>
          );
        })}
      </div>
    </fieldset>
  );
}
