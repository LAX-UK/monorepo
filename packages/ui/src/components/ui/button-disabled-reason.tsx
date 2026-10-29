"use client";

import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import * as React from "react";

/** What a disabled-with-reason control receives in place of the native `disabled` attribute. */
export type DisabledReasonControlProps = {
  "aria-disabled": true;
  "aria-describedby": string;
  onClick: (event: React.MouseEvent<HTMLElement>) => void;
};

export type DisabledReasonProps = {
  reason: string;
  /** Ids the control already points to; the reason is added after them. */
  describedBy?: string | undefined;
  children: (props: DisabledReasonControlProps) => React.ReactElement;
};

/**
 * Keeps a blocked control focusable and says why it is blocked. The control gets `aria-disabled`
 * instead of `disabled`, so it stays in the tab order and screen readers read the reason as its
 * description. Sighted people see the reason in a tooltip on hover or focus, and on a tap, where
 * hover does not exist. The tooltip is an inverse surface (the product's text colour behind its
 * surface colour) so it never reads as part of the grey button beneath it. Pressing the control never runs its action or submits its form.
 */
export function DisabledReason({ reason, describedBy, children }: DisabledReasonProps) {
  const reasonId = React.useId();
  const [open, setOpen] = React.useState(false);

  const control = children({
    "aria-disabled": true,
    "aria-describedby": describedBy ? `${describedBy} ${reasonId}` : reasonId,
    onClick: (event) => {
      // Cancels the action, form submission and link navigation; the default-prevented event
      // also stops the tooltip trigger from closing, so a tap shows the reason.
      event.preventDefault();
      setOpen(true);
    },
  });

  return (
    <TooltipPrimitive.Provider delayDuration={150}>
      <TooltipPrimitive.Root open={open} onOpenChange={setOpen}>
        <TooltipPrimitive.Trigger asChild>{control}</TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            sideOffset={8}
            collisionPadding={16}
            aria-hidden
            className="z-[var(--z-floating,70)] max-w-60 rounded-md bg-on-surface px-2.5 py-1.5 font-label text-xs leading-4 text-pretty text-surface shadow-md"
          >
            {reason}
            <TooltipPrimitive.Arrow width={10} height={5} className="fill-on-surface" />
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
      <span id={reasonId} className="sr-only">
        {reason}
      </span>
    </TooltipPrimitive.Provider>
  );
}
