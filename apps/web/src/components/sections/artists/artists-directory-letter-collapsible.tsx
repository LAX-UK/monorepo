"use client";

import type { ReactNode } from "react";

import { CollapsibleSection } from "@/components/ui/collapsible-section";

type Props = {
  letterBar: ReactNode;
};

export function ArtistsDirectoryLetterCollapsible({ letterBar }: Props) {
  return (
    <CollapsibleSection title="Jump to letter" className="mt-5 border-0 bg-transparent md:hidden">
      <div className="px-1 pb-2">{letterBar}</div>
    </CollapsibleSection>
  );
}
