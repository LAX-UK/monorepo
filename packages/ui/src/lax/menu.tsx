"use client";

import type * as React from "react";
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
} from "../components/ui/dropdown-menu.js";
import { cn } from "../lib/utils.js";
import { useLayerAttributes } from "./density.js";
import { ShortcutKeys } from "./kbd.js";

/*
 * Menus on the shared Radix wrappers. A menu is a raised surface (8px radius, shadow md, hairline)
 * holding 6px-radius items, 32px tall for staff and 36px for clients; destructive items are red
 * and sit last, after a separator.
 */

/**
 * A menu that leaves the page as it is: non-modal, so opening it never hides the rest of the page
 * from assistive technology (a hidden page with a focusable skip link fails WCAG), while focus
 * still moves into the menu, arrows move through it, and Escape or a click outside closes it and
 * returns focus to the button.
 */
export function Menu({
  modal = false,
  ...props
}: React.ComponentPropsWithoutRef<typeof DropdownMenu>) {
  return <DropdownMenu modal={modal} {...props} />;
}
export const MenuTrigger = DropdownMenuTrigger;

export function MenuContent({
  className,
  align = "end",
  ...props
}: React.ComponentPropsWithoutRef<typeof DropdownMenuContent>) {
  const layer = useLayerAttributes();
  return (
    <DropdownMenuContent
      {...layer}
      align={align}
      sideOffset={6}
      className={cn(
        "min-w-48 rounded-lax-menu border-lax-line bg-lax-raised p-1 text-lax-fg shadow-lax-md",
        className,
      )}
      {...props}
    />
  );
}

const itemClass = [
  "min-h-lax-control-sm gap-2 rounded-lax-control px-2 py-1.5 font-lax text-lax-ui text-lax-fg",
  "in-data-[lax-density=client]:min-h-lax-control-md in-data-[lax-density=client]:gap-x-3 in-data-[lax-density=client]:px-3",
  "focus:bg-lax-hover data-[highlighted]:bg-lax-hover",
  "data-[disabled]:text-lax-disabled-fg data-[disabled]:opacity-100",
  "[&>svg]:size-4 [&>svg]:text-lax-muted",
].join(" ");

export function MenuItem({
  className,
  tone = "default",
  shortcut,
  disabledReason,
  disabled,
  children,
  asChild,
  ...props
}: React.ComponentPropsWithoutRef<typeof DropdownMenuItem> & {
  tone?: "default" | "danger";
  /** The item's keyboard shortcut, right-aligned: "e", "mod+c". */
  shortcut?: string;
  /** Disables the item and says why, on a line under its label. */
  disabledReason?: string;
}) {
  const extras = !asChild && Boolean(shortcut || disabledReason);
  return (
    <DropdownMenuItem
      className={cn(
        itemClass,
        disabledReason && "flex-wrap gap-y-0.5",
        tone === "danger" &&
          // On its tinted highlight the item takes the danger foreground made for that tint, which
          // keeps 4.5:1 in dark mode; the plain danger red does not.
          "text-lax-danger [&>svg]:text-lax-danger focus:bg-lax-danger-bg focus:text-lax-danger-fg data-[highlighted]:bg-lax-danger-bg data-[highlighted]:text-lax-danger-fg focus:[&>svg]:text-lax-danger-fg data-[highlighted]:[&>svg]:text-lax-danger-fg",
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
            <span className="basis-full pl-6 text-lax-12 text-lax-muted in-data-[lax-density=client]:pl-7">
              {disabledReason}
            </span>
          ) : null}
        </>
      ) : (
        children
      )}
    </DropdownMenuItem>
  );
}

export function MenuCheckboxItem({
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

export const MenuRadioGroup = DropdownMenuRadioGroup;

/** One choice of several in a menu (density, page size); the chosen one shows a dot. */
export function MenuRadioItem({
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

export function MenuLabel({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof DropdownMenuLabel>) {
  return (
    <DropdownMenuLabel
      className={cn("px-2 pt-2 pb-1 text-lax-12 font-medium text-lax-muted", className)}
      {...props}
    />
  );
}

export function MenuSeparator({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof DropdownMenuSeparator>) {
  return <DropdownMenuSeparator className={cn("my-1 bg-lax-line", className)} {...props} />;
}
