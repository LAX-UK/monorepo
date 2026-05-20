"use client";

import { PaletteGroup } from "@/components/layout/palette/palette-group";
import type { PaletteItem, PaletteSection } from "@/components/layout/palette/types";
import { CommandEmpty, CommandList } from "@auction/ui";

type Props = {
  sections: PaletteSection[];
  loading?: boolean;
  onNavigate: (item: PaletteItem) => void;
};

export function PaletteResults({ sections, loading = false, onNavigate }: Props) {
  return (
    <CommandList className="max-h-[min(50vh,24rem)]">
      {loading ? (
        <p className="px-3 py-4 text-center font-body text-sm text-on-surface-variant">
          Searching…
        </p>
      ) : null}
      {!loading && sections.length === 0 ? <CommandEmpty>No matches.</CommandEmpty> : null}
      {sections.map((section) => (
        <PaletteGroup key={section.id} section={section} onNavigate={onNavigate} />
      ))}
    </CommandList>
  );
}
