"use client";

import { PaletteItemBadge } from "@/components/layout/palette/palette-item-badge";
import { paletteItemCommandValue } from "@/components/layout/palette/palette-item-presenter";
import type { PaletteItem } from "@/components/layout/palette/types";
import { cn } from "@auction/ui";
import { CommandItem } from "@auction/ui";
import { Search } from "lucide-react";

type Props = {
  item: PaletteItem;
  onNavigate: (item: PaletteItem) => void;
};

export function PaletteRow({ item, onNavigate }: Props) {
  const Icon = item.icon ?? Search;
  const ariaLabel = item.hint ? `${item.label}, ${item.hint}` : item.label;

  return (
    <CommandItem
      value={paletteItemCommandValue(item)}
      onSelect={() => onNavigate(item)}
      aria-label={ariaLabel}
      className={cn(
        "flex min-w-0 items-center gap-3 rounded-md py-2.5",
        "data-[selected=true]:bg-surface-container-high",
      )}
    >
      <Icon className="size-4 shrink-0 text-on-surface-variant" aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-body text-sm text-on-surface">{item.label}</span>
        {item.hint ? (
          <span className="block truncate font-label text-[10px] uppercase tracking-wider text-on-surface-variant">
            {item.hint}
          </span>
        ) : null}
      </span>
      <PaletteItemBadge item={item} />
    </CommandItem>
  );
}
