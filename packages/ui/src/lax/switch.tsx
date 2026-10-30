"use client";

import type * as React from "react";
import { Switch as SwitchRoot } from "../components/ui/switch.js";
import { cn } from "../lib/utils.js";

/**
 * The LAX switch: ink when on, the 3:1 control edge when off, a near-white thumb, and the one
 * focus ring. 32×20 for staff; 40×24 for clients, where it is a touch target in settings. The
 * colours and thumb are the same at both sizes.
 */
export function Switch({ className, ...props }: React.ComponentPropsWithoutRef<typeof SwitchRoot>) {
  return (
    <SwitchRoot
      className={cn(
        "h-5 w-8 border-0 p-0.5",
        "in-data-[lax-density=client]:h-6 in-data-[lax-density=client]:w-10 in-data-[lax-density=client]:p-1",
        "focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lax-focus",
        "data-[state=unchecked]:bg-lax-control-edge data-[state=checked]:bg-lax-ink",
        "hover:data-[state=unchecked]:bg-lax-control-edge-hover hover:data-[state=checked]:bg-lax-ink-hover",
        "disabled:opacity-100 disabled:data-[state=checked]:bg-lax-line-hover disabled:data-[state=unchecked]:bg-lax-line",
        // A disabled switch dims its thumb too, so it never reads as an active control.
        "disabled:data-[state=unchecked]:[&>span]:bg-lax-disabled-fg",
        className,
      )}
      thumbClassName={cn(
        "size-4 bg-lax-thumb shadow-lax-xs data-[state=checked]:translate-x-3 data-[state=checked]:bg-lax-on-ink data-[state=unchecked]:translate-x-0",
        "in-data-[lax-density=client]:data-[state=checked]:translate-x-4",
      )}
      {...props}
    />
  );
}
