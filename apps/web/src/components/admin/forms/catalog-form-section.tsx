"use client";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@auction/ui/components/collapsible";
import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";
import { useId, useState } from "react";

export type CatalogFormSectionProps = {
  title: string;
  description?: string;
  defaultOpen?: boolean;
  /** When false, section header is static (no accordion). */
  collapsible?: boolean;
  /** Optional DOM id for in-page section navigation. */
  anchorId?: string;
  children: ReactNode;
};

/**
 * Grouped fields for admin catalog forms (lots, sales, categories).
 * Matches the artist form accordion look; set `collapsible={false}` for always-open blocks.
 */
export function CatalogFormSection({
  title,
  description,
  defaultOpen = true,
  collapsible = true,
  anchorId,
  children,
}: CatalogFormSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  const contentId = `${id}-content`;

  if (!collapsible) {
    return (
      <div
        id={anchorId}
        className="scroll-mt-24 rounded-xl border border-outline-variant/25 bg-surface-container-lowest/40"
      >
        <div className="border-b border-border-hairline px-4 py-3">
          <span className="font-display text-base font-semibold tracking-tight text-on-surface">
            {title}
          </span>
          {description ? (
            <span className="mt-0.5 block text-xs text-on-surface-variant">{description}</span>
          ) : null}
        </div>
        <div className="space-y-4 px-4 pb-4 pt-4">{children}</div>
      </div>
    );
  }

  return (
    <Collapsible
      id={anchorId}
      open={open}
      onOpenChange={setOpen}
      className="scroll-mt-24 rounded-xl border border-outline-variant/25 bg-surface-container-lowest/40"
    >
      <CollapsibleTrigger
        type="button"
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-container-low/50"
        aria-expanded={open}
        aria-controls={contentId}
      >
        <span className="min-w-0">
          <span className="font-display text-base font-semibold tracking-tight text-on-surface">
            {title}
          </span>
          {description ? (
            <span className="mt-0.5 block text-xs text-on-surface-variant">{description}</span>
          ) : null}
        </span>
        <ChevronDown
          className={`size-5 shrink-0 text-on-surface-variant transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </CollapsibleTrigger>
      <CollapsibleContent id={contentId} className="border-t border-border-hairline px-4 pb-4 pt-2">
        <div className="space-y-4 pt-2">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  );
}
