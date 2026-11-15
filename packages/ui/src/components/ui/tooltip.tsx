"use client";

import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import * as React from "react";
import { useDensityAttribute } from "../../lax/density.js";
import { cn } from "../../lib/utils.js";

/** A tooltip opens after this delay (docs/design/motion.md); the next one opens at once. */
export const TOOLTIP_OPEN_DELAY_MS = 400;

const TooltipProvider = ({
  delayDuration = TOOLTIP_OPEN_DELAY_MS,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Provider>) => (
  <TooltipPrimitive.Provider delayDuration={delayDuration} {...props} />
);

const Tooltip = TooltipPrimitive.Root;

const TooltipTrigger = TooltipPrimitive.Trigger;

const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => {
  const density = useDensityAttribute();
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        ref={ref}
        sideOffset={sideOffset}
        data-lax-motion="tip"
        {...density}
        className={cn(
          "z-50 overflow-hidden rounded-md border border-outline-variant/20 bg-surface-container-highest px-3 py-1.5 text-xs text-on-surface shadow-md",
          className,
        )}
        {...props}
      />
    </TooltipPrimitive.Portal>
  );
});
TooltipContent.displayName = TooltipPrimitive.Content.displayName;

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };
