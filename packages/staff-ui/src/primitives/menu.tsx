"use client";

import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@auction/ui/components/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@auction/ui/components/tooltip";
import type * as React from "react";
import { type StaffPermission, useStaffCan } from "../access/staff-access.js";
import { STAFF_LAYER, cn } from "../lib/cn.js";
import { ShortcutKeys } from "./input.js";

/*
 * Menus and tooltips on the shared Radix wrappers. A menu is a raised surface (radius md, shadow
 * md, hairline) holding 32px items; destructive items are red and sit last, after a separator.
 */

/**
 * A menu that leaves the page as it is: non-modal, so opening it never hides the rest of the page
 * from assistive technology (a hidden page with a focusable skip link fails WCAG), while focus
 * still moves into the menu, arrows move through it, and Escape or a click outside closes it and
 * returns focus to the button.
 */
export function StaffMenu({
  modal = false,
  ...props
}: React.ComponentPropsWithoutRef<typeof DropdownMenu>) {
  return <DropdownMenu modal={modal} {...props} />;
}
export const StaffMenuTrigger = DropdownMenuTrigger;

export function StaffMenuContent({
  className,
  align = "end",
  ...props
}: React.ComponentPropsWithoutRef<typeof DropdownMenuContent>) {
  return (
    <DropdownMenuContent
      {...STAFF_LAYER}
      align={align}
      sideOffset={6}
      className={cn(
        "min-w-48 rounded-staff-md border-staff-line bg-staff-raised p-1 text-staff-fg shadow-staff-md",
        className,
      )}
      {...props}
    />
  );
}

const itemClass = [
  "min-h-control-sm gap-2 rounded-staff-xs px-2 py-1.5 font-staff text-staff-sm text-staff-fg",
  "focus:bg-staff-hover data-[highlighted]:bg-staff-hover",
  "data-[disabled]:text-staff-disabled data-[disabled]:opacity-100",
  "[&>svg]:size-4 [&>svg]:text-staff-muted",
].join(" ");

export function StaffMenuItem({
  className,
  tone = "default",
  shortcut,
  disabledReason,
  disabled,
  children,
  asChild,
  requires,
  ...props
}: React.ComponentPropsWithoutRef<typeof DropdownMenuItem> & {
  tone?: "default" | "danger";
  /** The item's keyboard shortcut, right-aligned: "e", "mod+c". */
  shortcut?: string;
  /** Disables the item and says why, on a line under its label. */
  disabledReason?: string;
  /** What the action needs; left out of the menu for people who may never take it. */
  requires?: StaffPermission;
}) {
  const permitted = useStaffCan(requires);
  if (!permitted) return null;
  const extras = !asChild && Boolean(shortcut || disabledReason);
  return (
    <DropdownMenuItem
      className={cn(
        itemClass,
        disabledReason && "flex-wrap gap-y-0.5",
        tone === "danger" &&
          "text-staff-danger focus:bg-staff-danger-bg focus:text-staff-danger data-[highlighted]:bg-staff-danger-bg [&>svg]:text-staff-danger",
        className,
      )}
      disabled={Boolean(disabled || disabledReason)}
      {...(asChild ? { asChild } : {})}
      {...props}
    >
      {extras ? (
        <>
          {children}
          {shortcut ? <ShortcutKeys keys={shortcut} className="ml-auto pl-4" /> : null}
          {disabledReason ? (
            <span className="basis-full pl-6 text-staff-xs text-staff-muted">{disabledReason}</span>
          ) : null}
        </>
      ) : (
        children
      )}
    </DropdownMenuItem>
  );
}

export function StaffMenuCheckboxItem({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof DropdownMenuCheckboxItem>) {
  return (
    <DropdownMenuCheckboxItem
      className={cn(itemClass, "pl-8 [&>span>span>svg]:size-4", className)}
      {...props}
    />
  );
}

export const StaffMenuRadioGroup = DropdownMenuRadioGroup;

/** One choice of several in a menu (density, page size); the chosen one shows a dot. */
export function StaffMenuRadioItem({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof DropdownMenuRadioItem>) {
  return (
    <DropdownMenuRadioItem
      className={cn(
        itemClass,
        "pl-8 [&>span>span>svg]:size-2 [&>span>span>svg]:fill-current",
        className,
      )}
      {...props}
    />
  );
}

export function StaffMenuLabel({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof DropdownMenuLabel>) {
  return (
    <DropdownMenuLabel
      className={cn("px-2 pt-2 pb-1 text-staff-xs font-medium text-staff-muted", className)}
      {...props}
    />
  );
}

export function StaffMenuSeparator({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof DropdownMenuSeparator>) {
  return <DropdownMenuSeparator className={cn("my-1 bg-staff-line", className)} {...props} />;
}

/**
 * The tooltip context `StaffShell` provides. Pages always render inside the shell; tests and
 * stand-alone previews that render kit parts without it wrap them in this.
 */
export function StaffTooltipProvider({ children }: { children: React.ReactNode }) {
  return <TooltipProvider delayDuration={300}>{children}</TooltipProvider>;
}

/** A short label on hover or focus, for icon-only buttons. Never holds essential content. */
export function StaffTooltip({
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
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent
        {...STAFF_LAYER}
        side={side}
        sideOffset={6}
        className={cn(
          "flex items-center gap-2 rounded-staff-xs border-0 bg-staff-ink px-2 py-1 font-staff text-staff-xs font-medium text-staff-on-ink shadow-staff-md",
          multiline && "max-w-80 text-pretty",
        )}
      >
        {label}
        {shortcut ? <span className="text-staff-disabled">{shortcut}</span> : null}
      </TooltipContent>
    </Tooltip>
  );
}
