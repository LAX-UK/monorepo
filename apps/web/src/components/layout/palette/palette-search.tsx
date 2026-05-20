"use client";

import { KbdHintMuted } from "@/components/marketing/kbd-hint";
import { CommandInput } from "@auction/ui";

type Props = {
  value: string;
  onValueChange: (value: string) => void;
};

export function PaletteSearch({ value, onValueChange }: Props) {
  const isMac =
    typeof navigator !== "undefined" && /Mac|iPhone|iPad|iPod/i.test(navigator.userAgent);

  return (
    <div className="border-b border-border-hairline px-1 pb-1">
      <CommandInput
        value={value}
        onValueChange={onValueChange}
        placeholder="Filter pages or search records…"
        className="h-11 border-0 font-body text-sm shadow-none focus-visible:ring-0"
      />
      <p className="px-3 pb-2 font-body text-xs text-on-surface-variant">
        Jump anywhere. Open with <KbdHintMuted>{isMac ? "⌘" : "Ctrl"}+K</KbdHintMuted>.
      </p>
    </div>
  );
}
