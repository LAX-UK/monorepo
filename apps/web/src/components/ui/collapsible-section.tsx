"use client";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@auction/ui/components/collapsible";
import { cn } from "@auction/ui/lib/utils";
import { ChevronDownIcon } from "lucide-react";
import type { ReactNode } from "react";

type Props = {
  title: string;
  children: ReactNode;
  className?: string;
  defaultOpen?: boolean;
};

export function CollapsibleSection({ title, children, className, defaultOpen = false }: Props) {
  return (
    <Collapsible
      defaultOpen={defaultOpen}
      className={cn(
        "rounded-lg border border-border-hairline bg-surface-container-low/40",
        className,
      )}
    >
      <CollapsibleTrigger className="flex w-full cursor-pointer items-center justify-between px-4 py-3 font-label text-xs font-semibold uppercase tracking-[0.12em] text-on-surface">
        {title}
        <ChevronDownIcon className="size-4 transition-transform [[data-state=open]_&]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent>{children}</CollapsibleContent>
    </Collapsible>
  );
}
