"use client";

import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@auction/ui/components/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@auction/ui/components/tooltip";
import type * as React from "react";
import { STAFF_LAYER, cn } from "../lib/cn.js";

/*
 * Menus and tooltips on the shared Radix wrappers. A menu is a raised surface (radius md, shadow
 * md, hairline) holding 32px items; destructive items are red and sit last, after a separator.
 */

export const StaffMenu = DropdownMenu;
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
  ...props
}: React.ComponentPropsWithoutRef<typeof DropdownMenuItem> & { tone?: "default" | "danger" }) {
  return (
    <DropdownMenuItem
      className={cn(
        itemClass,
        tone === "danger" &&
          "text-staff-danger focus:bg-staff-danger-bg focus:text-staff-danger data-[highlighted]:bg-staff-danger-bg [&>svg]:text-staff-danger",
        className,
      )}
      {...props}
    />
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

/** A short label on hover or focus, for icon-only buttons. Never holds essential content. */
export function StaffTooltip({
  label,
  side = "bottom",
  shortcut,
  children,
}: {
  label: string;
  side?: "top" | "right" | "bottom" | "left";
  shortcut?: string;
  children: React.ReactElement;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent
        {...STAFF_LAYER}
        side={side}
        sideOffset={6}
        className="flex items-center gap-2 rounded-staff-xs border-0 bg-staff-ink px-2 py-1 font-staff text-staff-xs font-medium text-staff-on-ink shadow-staff-md"
      >
        {label}
        {shortcut ? <span className="text-staff-disabled">{shortcut}</span> : null}
      </TooltipContent>
    </Tooltip>
  );
}
