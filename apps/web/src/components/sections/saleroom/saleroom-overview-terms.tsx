"use client";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@auction/ui/components/collapsible";
import { ChevronDownIcon } from "lucide-react";
import type { SaleOverviewVM } from "./view-models";

type Props = {
  overview: SaleOverviewVM;
};

/** Collapsible full terms body. */
export function SaleroomOverviewTerms({ overview }: Props) {
  if (!overview.terms) return null;

  return (
    <Collapsible className="group mt-6 rounded border border-outline-variant/30 bg-surface-container-low/30 p-4 data-[state=open]:bg-surface-container-low/50 dark:bg-surface-container-low/30 dark:data-[state=open]:bg-surface-container/40">
      <CollapsibleTrigger className="flex w-full cursor-pointer items-center justify-between text-lg font-semibold text-on-surface">
        <span className="underline decoration-outline-variant/50 underline-offset-2 group-data-[state=open]:decoration-on-surface">
          Terms &amp; conditions
        </span>
        <ChevronDownIcon className="size-5 transition-transform group-data-[state=open]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-4 whitespace-pre-wrap text-base leading-6 text-on-surface">
          {overview.terms}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
