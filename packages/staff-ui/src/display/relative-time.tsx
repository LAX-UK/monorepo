"use client";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@auction/ui/components/tooltip";
import * as React from "react";
import { STAFF_LAYER, cn } from "../lib/cn.js";
import { formatStaffDateTime, formatStaffRelative } from "../lib/format.js";

/** How often a relative time re-reads the clock, so "just now" moves on without a reload. */
const REFRESH_MS = 60_000;

/**
 * "3 minutes ago", for activity feeds only. The exact London time shows in a tooltip, is read by
 * screen readers after the relative one, and sits in `<time datetime>` for copy and machines.
 */
export function RelativeTime({
  value,
  zoneLabel = false,
  className,
}: {
  /** ISO timestamp. */
  value: string;
  /** Adds BST or GMT to the exact time, where the moment matters. */
  zoneLabel?: boolean;
  className?: string;
}) {
  const [now, setNow] = React.useState<Date | null>(null);
  React.useEffect(() => {
    setNow(new Date());
    const timer = window.setInterval(() => setNow(new Date()), REFRESH_MS);
    return () => window.clearInterval(timer);
  }, []);
  const exact = formatStaffDateTime(value, { zoneLabel });
  // Until the browser has a clock, render the exact time, so server and client agree.
  const relative = now ? formatStaffRelative(value, now) : exact;
  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <time dateTime={value} className={cn("tabular-nums", className)}>
            <span aria-hidden={relative !== exact || undefined}>{relative}</span>
            {relative !== exact ? <span className="sr-only">{`${relative}, ${exact}`}</span> : null}
          </time>
        </TooltipTrigger>
        <TooltipContent
          {...STAFF_LAYER}
          side="top"
          sideOffset={6}
          className="rounded-staff-xs border-0 bg-staff-ink px-2 py-1 font-staff text-staff-xs font-medium text-staff-on-ink shadow-staff-md"
        >
          {exact}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
