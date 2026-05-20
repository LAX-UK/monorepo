"use client";

import type { PaletteItem } from "@/components/layout/palette/types";
import { CommandItem } from "@auction/ui";

type Props = {
  item: PaletteItem;
  onNavigate: (item: PaletteItem) => void;
};

export function PaletteRow({ item, onNavigate }: Props) {
  return (
    <CommandItem
      value={`${item.id} ${item.label} ${item.hint ?? ""}`}
      onSelect={() => onNavigate(item)}
      className="flex flex-col items-start gap-0.5 py-2.5"
    >
      <span className="font-body text-sm text-on-surface">{item.label}</span>
      {item.hint ? (
        <span className="font-label text-[10px] uppercase tracking-wider text-on-surface-variant">
          {item.hint}
        </span>
      ) : null}
    </CommandItem>
  );
}
