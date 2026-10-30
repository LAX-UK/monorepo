"use client";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@auction/ui/components/collapsible";
import { ChevronRight } from "lucide-react";

type Props = {
  /** "What can I do here as an owner?" */
  question: string;
  explanation: string;
};

/** The member's role in one paragraph, opened on request, at the foot of Home. */
export function HomeRoleGuide({ question, explanation }: Props) {
  return (
    <Collapsible className="border-t border-lax-line pt-4" data-testid="home-role-guide">
      <CollapsibleTrigger className="group inline-flex min-h-11 items-center gap-2 rounded-lax-control text-lax-14 text-lax-muted transition-colors duration-150 hover:text-lax-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lax-focus">
        <ChevronRight
          className="size-3.5 transition-transform duration-150 group-data-[state=open]:rotate-90 motion-reduce:transition-none"
          strokeWidth={1.75}
          aria-hidden
        />
        {question}
      </CollapsibleTrigger>
      <CollapsibleContent>
        <p className="max-w-2xl pb-1 pl-5.5 text-lax-14 leading-6 text-lax-muted">{explanation}</p>
      </CollapsibleContent>
    </Collapsible>
  );
}
