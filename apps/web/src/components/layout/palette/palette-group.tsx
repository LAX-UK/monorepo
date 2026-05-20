"use client";

import { PaletteRow } from "@/components/layout/palette/palette-row";
import type { PaletteItem, PaletteSection } from "@/components/layout/palette/types";
import { CommandGroup } from "@auction/ui";

type Props = {
  section: PaletteSection;
  onNavigate: (item: PaletteItem) => void;
};

export function PaletteGroup({ section, onNavigate }: Props) {
  return (
    <CommandGroup heading={section.heading}>
      {section.items.map((item) => (
        <PaletteRow key={item.id} item={item} onNavigate={onNavigate} />
      ))}
    </CommandGroup>
  );
}
