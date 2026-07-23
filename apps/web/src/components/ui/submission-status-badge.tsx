"use client";

import { usePrefersHover } from "@/hooks/use-prefers-hover";
import {
  SELLER_SUBMISSION_STATUS_LABELS,
  SUBMISSION_STATUS_HINTS,
} from "@/lib/marketing/sell-flow-copy";
import { resolveDotStatusPresentation } from "@/lib/presenters/status-presentation";
import type { ItemSubmissionStatus } from "@auction/types";
import { Button } from "@auction/ui/components/button";
import { DotStatusPill } from "@auction/ui/components/dot-status-pill";
import { Popover, PopoverContent, PopoverTrigger } from "@auction/ui/components/popover";
import { CircleAlert } from "lucide-react";
import { useCallback, useState } from "react";

type Props = {
  status: ItemSubmissionStatus;
  /** When true (default), show an info icon with the status explanation in a popover. */
  showHint?: boolean;
};

function StatusHintContent({ label, hint }: { label: string; hint: string }) {
  return (
    <>
      <p className="font-medium text-on-surface">{label}</p>
      <p className="mt-1">{hint}</p>
    </>
  );
}

export function SubmissionStatusBadge({ status, showHint = true }: Props) {
  const label = SELLER_SUBMISSION_STATUS_LABELS[status];
  const hint = SUBMISSION_STATUS_HINTS[status];
  const presentation = resolveDotStatusPresentation("submission", status);
  const prefersHover = usePrefersHover();
  const [open, setOpen] = useState(false);

  const showOnHover = useCallback(() => {
    if (prefersHover) setOpen(true);
  }, [prefersHover]);

  const hideOnHover = useCallback(() => {
    if (prefersHover) setOpen(false);
  }, [prefersHover]);

  return (
    <span className="inline-flex items-center gap-1">
      <DotStatusPill label={label} tone={presentation.tone} />
      {showHint && hint ? (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-auto min-h-0 min-w-0 shrink-0 rounded-full p-0 opacity-80 hover:opacity-100 hover:bg-transparent [&_svg]:size-3"
              aria-label={`What ${label} means`}
              onClick={(e) => e.stopPropagation()}
              onMouseEnter={showOnHover}
              onMouseLeave={hideOnHover}
            >
              <CircleAlert aria-hidden />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            className="max-w-xs p-3 font-body text-sm text-on-surface-variant"
            onMouseEnter={showOnHover}
            onMouseLeave={hideOnHover}
          >
            <StatusHintContent label={label} hint={hint} />
          </PopoverContent>
        </Popover>
      ) : null}
    </span>
  );
}
