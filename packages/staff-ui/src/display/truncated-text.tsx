"use client";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@auction/ui/components/tooltip";
import * as React from "react";
import type { CellTruncation } from "../data/types.js";
import { STAFF_LAYER, cn } from "../lib/cn.js";

/** How long the pointer rests on shortened text before the full value appears. */
export const STAFF_TRUNCATION_TOOLTIP_DELAY_MS = 500;

/** Characters kept at the end of a middle-truncated string ("mahmo…@gmail.com"). */
const MIDDLE_TAIL = 10;

function splitForMiddle(text: string): [string, string] {
  const at = text.lastIndexOf("@");
  const tailStart = at > 0 && text.length - at <= 24 ? at : Math.max(0, text.length - MIDDLE_TAIL);
  return [text.slice(0, tailStart), text.slice(tailStart)];
}

function isClipped(element: HTMLElement | null): boolean {
  return Boolean(element && element.scrollWidth > element.clientWidth + 1);
}

/**
 * One line of text that shortens with an ellipsis when it does not fit, and shows the full value
 * in a tooltip after a short rest of the pointer. The full text stays in the DOM, so screen
 * readers and Find in page read all of it. `mode="middle"` keeps the end of a string visible, for
 * emails and references.
 */
export function TruncatedText({
  children,
  mode = "end",
  className,
}: {
  children: React.ReactNode;
  mode?: Exclude<CellTruncation, false>;
  className?: string;
}) {
  const clipRef = React.useRef<HTMLSpanElement>(null);
  const rootRef = React.useRef<HTMLSpanElement>(null);
  const [open, setOpen] = React.useState(false);
  const middle = mode === "middle" && typeof children === "string";
  const [head, tail] = middle ? splitForMiddle(children) : ["", ""];

  return (
    <TooltipProvider delayDuration={STAFF_TRUNCATION_TOOLTIP_DELAY_MS}>
      <Tooltip open={open} onOpenChange={(next) => setOpen(next && isClipped(clipRef.current))}>
        <TooltipTrigger asChild>
          <span
            ref={rootRef}
            data-staff-truncate={mode}
            className={cn("block min-w-0", middle && "flex", className)}
          >
            {middle ? (
              <>
                <span ref={clipRef} className="min-w-0 truncate">
                  {head}
                </span>
                <span className="shrink-0 whitespace-pre">{tail}</span>
              </>
            ) : (
              <span ref={clipRef} className="block truncate">
                {children}
              </span>
            )}
          </span>
        </TooltipTrigger>
        <TooltipContent
          {...STAFF_LAYER}
          side="top"
          align="start"
          sideOffset={6}
          className="max-w-[min(480px,90vw)] rounded-staff-xs border-0 bg-staff-ink px-2 py-1 font-staff text-staff-xs font-medium break-words text-staff-on-ink shadow-staff-md"
        >
          {rootRef.current?.textContent ?? children}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
