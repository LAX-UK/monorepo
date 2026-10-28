"use client";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@auction/ui/components/tooltip";
import { Slot, Slottable } from "@radix-ui/react-slot";
import { type VariantProps, cva } from "class-variance-authority";
import { LoaderCircle } from "lucide-react";
import * as React from "react";
import { type StaffPermission, useStaffCan } from "../access/staff-access.js";
import { STAFF_LAYER, cn } from "../lib/cn.js";

/**
 * The staff button. Four variants and two heights cover every action in both admins:
 * primary (one per view), secondary, ghost (toolbars, rows) and danger (destructive confirms).
 * Icons are 16px in every size so they centre on the same optical line as the label.
 */
export const staffButtonVariants = cva(
  [
    "relative inline-flex shrink-0 select-none items-center justify-center gap-1.5 whitespace-nowrap",
    "rounded-staff-sm font-staff text-staff-sm font-medium",
    "transition-[background-color,border-color,color,box-shadow] duration-150 ease-out",
    "staff-focus staff-target",
    "disabled:cursor-not-allowed aria-disabled:pointer-events-none",
    "data-[loading]:cursor-progress",
    "[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  ],
  {
    variants: {
      variant: {
        primary: [
          "bg-staff-ink text-staff-on-ink",
          "hover:bg-staff-ink-hover active:opacity-90",
          "disabled:bg-staff-line disabled:text-staff-disabled aria-disabled:bg-staff-line aria-disabled:text-staff-disabled aria-disabled:opacity-100",
        ],
        secondary: [
          "border border-staff-line-strong bg-staff-surface text-staff-fg shadow-staff-xs",
          "hover:staff-overlay-hover active:staff-overlay-pressed",
          "disabled:border-staff-line disabled:bg-staff-sunken disabled:text-staff-disabled disabled:shadow-none",
          "aria-disabled:border-staff-line aria-disabled:bg-staff-sunken aria-disabled:text-staff-disabled aria-disabled:shadow-none",
          "disabled:bg-none aria-disabled:bg-none",
          "data-[state=open]:staff-overlay-pressed",
        ],
        ghost: [
          "bg-transparent text-staff-fg",
          "hover:bg-staff-hover active:bg-staff-pressed data-[state=open]:bg-staff-pressed",
          "disabled:bg-transparent disabled:text-staff-disabled aria-disabled:bg-transparent aria-disabled:text-staff-disabled",
        ],
        danger: [
          "bg-staff-danger-solid text-staff-on-danger",
          "hover:bg-staff-danger-solid-hover active:opacity-90",
          "disabled:bg-staff-line disabled:text-staff-disabled aria-disabled:bg-staff-line aria-disabled:text-staff-disabled aria-disabled:opacity-100",
        ],
        "danger-secondary": [
          "border border-staff-line-strong bg-staff-surface text-staff-danger shadow-staff-xs",
          "hover:staff-overlay-hover active:staff-overlay-pressed",
          "disabled:border-staff-line disabled:bg-staff-sunken disabled:text-staff-disabled disabled:shadow-none",
          "aria-disabled:border-staff-line aria-disabled:bg-staff-sunken aria-disabled:text-staff-disabled aria-disabled:shadow-none",
          "disabled:bg-none aria-disabled:bg-none",
        ],
      },
      size: {
        sm: "h-control-sm px-3",
        md: "h-control-md px-3.5",
        /** 44px at every pointer, for the actions a clerk takes under time pressure. */
        live: "h-11 px-4",
        "icon-xs": "size-control-xs rounded-staff-xs",
        "icon-sm": "size-control-sm",
        "icon-md": "size-control-md",
      },
    },
    defaultVariants: { variant: "secondary", size: "md" },
  },
);

export type StaffButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof staffButtonVariants> & {
    /** Render the child (e.g. a router link) with button styling. */
    asChild?: boolean;
    /** Shows a spinner in place of the leading icon and blocks repeat clicks; width is kept. */
    loading?: boolean;
    /** Leading icon element, e.g. `<Plus />`. */
    icon?: React.ReactNode;
    /**
     * Disables the button and says why ("Refunds open once payment settles"). The button stays
     * focusable (`aria-disabled`, not `disabled`) and shows the reason in a tooltip on hover and
     * focus, so keyboard and screen reader users can find out what blocks it.
     */
    disabledReason?: string;
    /**
     * What the action needs. People who may never take it do not see the button at all; the
     * same rule guards the route behind it.
     */
    requires?: StaffPermission;
  };

export const StaffButton = React.forwardRef<HTMLButtonElement, StaffButtonProps>(
  (
    {
      className,
      variant,
      size,
      asChild = false,
      loading = false,
      icon,
      disabled,
      disabledReason,
      requires,
      children,
      type,
      ...props
    },
    ref,
  ) => {
    const permitted = useStaffCan(requires);
    if (!permitted) return null;
    const Comp = asChild ? Slot : "button";
    const leading = loading ? <LoaderCircle aria-hidden className="animate-spin" /> : icon;
    const explained = Boolean(disabledReason) && !loading;
    const button = (
      <Comp
        ref={ref}
        className={cn(
          staffButtonVariants({ variant, size }),
          explained && "cursor-not-allowed aria-disabled:pointer-events-auto",
          className,
        )}
        {...(asChild ? {} : { type: type ?? "button", disabled: explained ? undefined : disabled })}
        {...((asChild && disabled) || explained ? { "aria-disabled": true } : {})}
        {...props}
        {...(explained
          ? {
              // Focusable but inert: the press is swallowed, the reason is shown instead.
              onClick: (event: React.MouseEvent<HTMLButtonElement>) => event.preventDefault(),
            }
          : {})}
        {...(loading
          ? {
              "aria-busy": true,
              "data-loading": "",
              // Keeps its colours while busy (not the disabled look) but ignores repeat presses.
              onClick: (event: React.MouseEvent<HTMLButtonElement>) => event.preventDefault(),
            }
          : {})}
      >
        {leading}
        <Slottable>{children}</Slottable>
      </Comp>
    );
    if (!explained || !disabledReason) return button;
    // Its own provider, so a button that explains itself works outside the shell too.
    return (
      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>{button}</TooltipTrigger>
          <TooltipContent
            {...STAFF_LAYER}
            side="top"
            sideOffset={6}
            className="max-w-72 rounded-staff-xs border-0 bg-staff-ink px-2 py-1 font-staff text-staff-xs font-medium text-staff-on-ink shadow-staff-md"
          >
            {disabledReason}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  },
);
StaffButton.displayName = "StaffButton";
