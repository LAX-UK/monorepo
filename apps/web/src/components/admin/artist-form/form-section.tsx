"use client";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@auction/ui/components/collapsible";
import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";
import { useId, useState } from "react";

type Props = {
  title: string;
  description?: string;
  defaultOpen?: boolean;
  children: ReactNode;
};

/** Collapsible wrapper for grouped artist form fields (single layout concern). */
export function ArtistFormSection({ title, description, defaultOpen = true, children }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  const contentId = `${id}-content`;

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className="rounded-xl border border-outline-variant/25 bg-surface-container-lowest/40"
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
      <CollapsibleContent
        id={contentId}
        className="border-t border-outline-variant/20 px-4 pb-4 pt-2"
      >
        <div className="space-y-4 pt-2">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  );
}
