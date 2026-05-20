"use client";

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@auction/ui";
import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";

/** Collapsed by default: IDs, audit trail, and technical fields for staff. */
export function SubmissionInternalDetailsCollapsible({ children }: { children: ReactNode }) {
  return (
    <Collapsible
      defaultOpen={false}
      className="rounded-xl border border-border-hairline bg-surface-container-low/25"
    >
      <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary hover:bg-surface-container-low/40 [&[data-state=open]>svg]:rotate-180">
        <span>Internal & system metadata</span>
        <ChevronDown className="size-4 shrink-0 transition-transform" aria-hidden />
      </CollapsibleTrigger>
      <CollapsibleContent className="border-t border-border-hairline px-4 py-3 text-sm">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}
