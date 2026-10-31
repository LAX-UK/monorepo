"use client";

import { Lock } from "lucide-react";
import * as React from "react";
import { Switch as SwitchRoot } from "../components/ui/switch.js";
import { cn } from "../lib/utils.js";
import { ReasonTooltip } from "./tooltip.js";

type SwitchRootProps = React.ComponentPropsWithoutRef<typeof SwitchRoot>;

export type SwitchProps = SwitchRootProps & {
  /**
   * Held on by a rule the person cannot change here ("Required while you're bidding"). The
   * switch stays focusable and reads the reason as its description and in a tooltip; it shows a
   * lock in its thumb on a filled (on) track, so it never reads as off or as a broken control.
   */
  lockedReason?: string;
};

const SIZE = cn(
  "h-5 w-8 border-0 p-0.5",
  "in-data-[lax-density=client]:h-6 in-data-[lax-density=client]:w-10 in-data-[lax-density=client]:p-1",
);

const THUMB = cn(
  "size-4 bg-lax-thumb shadow-lax-xs data-[state=checked]:translate-x-3 data-[state=checked]:bg-lax-on-ink data-[state=unchecked]:translate-x-0",
  "in-data-[lax-density=client]:data-[state=checked]:translate-x-4",
);

/**
 * The LAX switch: ink when on, the 3:1 control edge when off, a near-white thumb, and the one
 * focus ring. 32×20 for staff; 40×24 for clients, where it is a touch target in settings. The
 * colours and thumb are the same at both sizes.
 */
export function Switch({ className, lockedReason, ...props }: SwitchProps) {
  if (lockedReason) return <LockedSwitch reason={lockedReason} className={className} {...props} />;
  return (
    <SwitchRoot
      className={cn(
        SIZE,
        "focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lax-focus",
        "data-[state=unchecked]:bg-lax-control-edge data-[state=checked]:bg-lax-ink",
        "hover:data-[state=unchecked]:bg-lax-control-edge-hover hover:data-[state=checked]:bg-lax-ink-hover",
        "disabled:opacity-100 disabled:data-[state=checked]:bg-lax-line-hover disabled:data-[state=unchecked]:bg-lax-line",
        // A disabled switch dims its thumb too, so it never reads as an active control.
        "disabled:data-[state=unchecked]:[&>span]:bg-lax-disabled-fg",
        className,
      )}
      thumbClassName={THUMB}
      {...props}
    />
  );
}

/**
 * On, and held on. Focusable but inert: a press changes nothing. It is drawn on (ink track, thumb
 * at the end) with a lock in the thumb, and "On." with the reason is its description.
 */
function LockedSwitch({
  reason,
  className,
  "aria-describedby": describedBy,
  onCheckedChange: _ignored,
  checked: _checked,
  defaultChecked: _defaultChecked,
  disabled: _disabled,
  ...props
}: SwitchRootProps & { reason: string }) {
  const reasonId = React.useId();
  return (
    <span className="relative inline-flex shrink-0">
      <ReasonTooltip reason={reason}>
        <SwitchRoot
          checked
          aria-disabled
          aria-describedby={[describedBy, reasonId].filter(Boolean).join(" ")}
          data-locked=""
          onClick={(event) => event.preventDefault()}
          className={cn(
            SIZE,
            "relative cursor-not-allowed",
            "focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lax-focus",
            "data-[state=checked]:bg-lax-ink",
            className,
          )}
          thumbClassName={THUMB}
          {...props}
        />
      </ReasonTooltip>
      <Lock
        aria-hidden
        strokeWidth={2.25}
        className="pointer-events-none absolute top-1/2 right-[5px] size-2.5 -translate-y-1/2 text-lax-ink in-data-[lax-density=client]:right-[7px]"
      />
      <span id={reasonId} className="sr-only">
        {`On. ${reason}`}
      </span>
    </span>
  );
}
