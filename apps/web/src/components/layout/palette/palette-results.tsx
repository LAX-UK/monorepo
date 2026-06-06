"use client";

import { PaletteEmptyState } from "@/components/layout/palette/palette-empty-state";
import { PaletteFooter } from "@/components/layout/palette/palette-footer";
import { PaletteGroup } from "@/components/layout/palette/palette-group";
import { PaletteSkeleton } from "@/components/layout/palette/palette-skeleton";
import type { PaletteItem, PaletteSection } from "@/components/layout/palette/types";
import { CommandList } from "@auction/ui";

type Props = {
  sections: PaletteSection[];
  query: string;
  loading?: boolean;
  listClassName?: string;
  onNavigate: (item: PaletteItem) => void;
};

export function PaletteResults({
  sections,
  query,
  loading = false,
  listClassName = "max-h-[min(50vh,24rem)]",
  onNavigate,
}: Props) {
  const showSkeleton = loading && sections.length === 0;
  const showEmpty = !loading && sections.length === 0;

  return (
    <>
      <CommandList className={listClassName}>
        {showSkeleton ? <PaletteSkeleton /> : null}
        {showEmpty ? <PaletteEmptyState query={query} /> : null}
        {sections.map((section) => (
          <PaletteGroup key={section.id} section={section} onNavigate={onNavigate} />
        ))}
      </CommandList>
      <PaletteFooter />
    </>
  );
}
