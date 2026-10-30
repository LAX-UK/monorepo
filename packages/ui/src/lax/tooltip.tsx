"use client";

import type * as React from "react";
import {
  TooltipContent,
  Tooltip as TooltipRoot,
  TooltipProvider as TooltipRootProvider,
  TooltipTrigger,
} from "../components/ui/tooltip.js";
import { cn } from "../lib/utils.js";
import { useLayerAttributes } from "./density.js";

/** The tooltip surface: a small ink label, 12/16 at 500, raised over everything. */
export const tooltipClass =
  "flex items-center gap-2 rounded-lax-badge border-0 bg-lax-ink px-2 py-1 font-lax text-lax-12 font-medium text-lax-on-ink shadow-lax-md";

/**
 * The tooltip context a shell provides once. Pages always render inside a shell; tests and
 * stand-alone previews that render primitives without one wrap them in this.
 */
export function TooltipProvider({ children }: { children: React.ReactNode }) {
  return <TooltipRootProvider delayDuration={300}>{children}</TooltipRootProvider>;
}

/** A short label on hover or focus, for icon-only buttons. Never holds essential content. */
export function Tooltip({
  label,
  side = "bottom",
  shortcut,
  multiline = false,
  children,
}: {
  label: string;
  side?: "top" | "right" | "bottom" | "left";
  shortcut?: string;
  /** A sentence rather than a name: wraps at 320px instead of running on one line. */
  multiline?: boolean;
  children: React.ReactElement;
}) {
  const layer = useLayerAttributes();
  return (
    <TooltipRoot>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent
        {...layer}
        side={side}
        sideOffset={6}
        className={cn(tooltipClass, multiline && "max-w-80 text-pretty")}
      >
        {label}
        {shortcut ? <span className="text-lax-disabled-fg">{shortcut}</span> : null}
      </TooltipContent>
    </TooltipRoot>
  );
}

/**
 * The reason a control is unavailable, on hover and focus. It brings its own provider, so a
 * control that explains itself works outside a shell too.
 */
export function ReasonTooltip({
  reason,
  side = "top",
  children,
}: {
  reason: string;
  side?: "top" | "right" | "bottom" | "left";
  children: React.ReactElement;
}) {
  const layer = useLayerAttributes();
  return (
    <TooltipRootProvider delayDuration={300}>
      <TooltipRoot>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent
          {...layer}
          side={side}
          sideOffset={6}
          className={cn(tooltipClass, "block max-w-72")}
        >
          {reason}
        </TooltipContent>
      </TooltipRoot>
    </TooltipRootProvider>
  );
}
