"use client";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@auction/ui/components/collapsible";
import { ChevronDown, CircleHelp } from "lucide-react";

/** "What can I do here?": the member's role in one paragraph, opened on request. */
export function HomeRoleGuide({ explanation }: { explanation: string }) {
  return (
    <Collapsible className="max-w-2xl" data-testid="home-role-guide">
      <CollapsibleTrigger className="group inline-flex min-h-11 items-center gap-1.5 rounded-sm font-body text-sm font-medium text-on-surface underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
        <CircleHelp className="size-4 text-on-surface-variant" strokeWidth={1.75} aria-hidden />
        What can I do here?
        <ChevronDown
          className="size-4 text-on-surface-variant transition-transform group-data-[state=open]:rotate-180"
          strokeWidth={1.75}
          aria-hidden
        />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <p className="mt-1 font-body text-sm leading-relaxed text-on-surface-variant">
          {explanation}
        </p>
      </CollapsibleContent>
    </Collapsible>
  );
}
