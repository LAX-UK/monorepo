"use client";

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@auction/ui/components/command";
import { Popover, PopoverContent, PopoverTrigger } from "@auction/ui/components/popover";
import { Check, LoaderCircle } from "lucide-react";
import * as React from "react";
import { STAFF_LAYER, cn } from "../lib/cn.js";
import { staffCommandClass, staffCommandItemClass } from "./command-styles.js";

export type CommandMenuItem = {
  id: string;
  label: string;
  /** A second line: "Specialist · 9 open", the opening of a saved reply. */
  description?: string;
  /** Before the label, e.g. initials. */
  leading?: React.ReactNode;
  /** Marked with a tick (the current choice). */
  checked?: boolean;
  /** Extra words the search matches. */
  keywords?: readonly string[];
  onSelect: () => void;
};

export type CommandMenuGroup = { id: string; heading?: string; items: readonly CommandMenuItem[] };

export type CommandMenuProps = {
  /** The button that opens it (rendered as the popover trigger). */
  trigger: React.ReactElement;
  /** The popover's accessible name. */
  label: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  searchPlaceholder: string;
  groups: readonly CommandMenuGroup[];
  /** A control above the search that applies to the choice, e.g. an end date for a cover. */
  header?: React.ReactNode;
  /** Items after a separator, unaffected by the search: "Unassign". */
  footer?: readonly CommandMenuItem[];
  /** One line of help under the list: "Inserted for editing. Placeholders fill in." */
  note?: React.ReactNode;
  emptyText?: string;
  loading?: boolean;
  /** Shown instead of the list, e.g. when the options could not load. */
  error?: React.ReactNode;
  align?: "start" | "end";
  className?: string;
};

/**
 * A button that opens a searchable list of actions: assign to a colleague, insert a saved reply.
 * Type to filter, arrows to move, Enter to choose, Escape to close; choosing closes the menu.
 */
export function CommandMenu({
  trigger,
  label,
  open: openProp,
  onOpenChange,
  searchPlaceholder,
  groups,
  header,
  footer = [],
  note,
  emptyText = "No matches.",
  loading = false,
  error,
  align = "start",
  className,
}: CommandMenuProps) {
  const [openState, setOpenState] = React.useState(false);
  const open = openProp ?? openState;
  const setOpen = (next: boolean) => {
    if (openProp === undefined) setOpenState(next);
    onOpenChange?.(next);
  };
  const choose = (item: CommandMenuItem) => {
    setOpen(false);
    item.onSelect();
  };
  const row = (item: CommandMenuItem, searchable: boolean) => (
    <CommandItem
      key={item.id}
      value={
        searchable
          ? `${item.label} ${item.description ?? ""} ${(item.keywords ?? []).join(" ")} ${item.id}`
          : `__footer ${item.id}`
      }
      onSelect={() => choose(item)}
      className={cn(staffCommandItemClass, "items-start")}
      {...(searchable ? {} : { forceMount: true })}
    >
      <Check
        aria-hidden
        className={cn("mt-0.5 shrink-0", item.checked ? "opacity-100" : "opacity-0")}
      />
      {item.leading ? <span className="shrink-0">{item.leading}</span> : null}
      <span className="flex min-w-0 flex-col">
        <span className="truncate">{item.label}</span>
        {item.description ? (
          <span className="truncate text-staff-xs text-staff-muted">{item.description}</span>
        ) : null}
      </span>
      {item.checked ? <span className="sr-only">(current)</span> : null}
    </CommandItem>
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent
        {...STAFF_LAYER}
        align={align}
        sideOffset={6}
        aria-label={label}
        className={cn(
          "w-80 max-w-[calc(100vw-2rem)] rounded-staff-md border border-staff-line bg-staff-raised p-0 text-staff-fg shadow-staff-md",
          className,
        )}
      >
        {header ? <div className="border-b border-staff-line-subtle p-3">{header}</div> : null}
        <Command className={staffCommandClass}>
          <CommandInput placeholder={searchPlaceholder} aria-label={searchPlaceholder} />
          {error ? (
            <div className="px-3 py-4 text-staff-sm text-staff-muted">{error}</div>
          ) : loading ? (
            <output className="flex items-center gap-2 px-3 py-3 text-staff-sm text-staff-muted">
              <LoaderCircle aria-hidden className="size-4 animate-spin" />
              Loading…
            </output>
          ) : (
            <CommandList className="max-h-96 p-1">
              <CommandEmpty className="px-2 py-6 text-center text-staff-sm text-staff-muted">
                {emptyText}
              </CommandEmpty>
              {groups.map((group) => (
                <CommandGroup key={group.id} heading={group.heading} className="p-0">
                  {group.items.map((item) => row(item, true))}
                </CommandGroup>
              ))}
              {footer.length > 0 ? (
                // A rule, not a separator element: a listbox holds only options and groups.
                <CommandGroup
                  className="mt-1 border-t border-staff-line-subtle p-0 pt-1"
                  forceMount
                >
                  {footer.map((item) => row(item, false))}
                </CommandGroup>
              ) : null}
            </CommandList>
          )}
          {note ? (
            <p className="border-t border-staff-line-subtle px-3 py-2.5 text-staff-xs text-staff-muted">
              {note}
            </p>
          ) : null}
        </Command>
      </PopoverContent>
    </Popover>
  );
}
