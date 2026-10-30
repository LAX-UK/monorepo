"use client";

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@auction/ui/components/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@auction/ui/components/dialog";
import { Kbd, useReturnFocus } from "@auction/ui/lax";
import { CornerDownLeft, LoaderCircle } from "lucide-react";
import * as React from "react";
import { staffCommandClass, staffCommandItemClass } from "../forms/command-styles.js";
import { STAFF_LAYER } from "../lib/cn.js";
import type { StaffCommand, StaffCommandSearch } from "./types.js";

/** Opens on ⌘K (Ctrl+K on Windows and Linux) from anywhere in the shell. */
export function useCommandPaletteShortcut(onToggle: () => void) {
  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key?.toLowerCase() !== "k" || !(event.metaKey || event.ctrlKey)) return;
      event.preventDefault();
      onToggle();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onToggle]);
}

function groupCommands(commands: readonly StaffCommand[]) {
  const groups = new Map<string, StaffCommand[]>();
  for (const command of commands) {
    const list = groups.get(command.group) ?? [];
    list.push(command);
    groups.set(command.group, list);
  }
  return [...groups.entries()];
}

/**
 * Search and jump anywhere: pages from the nav, actions, and live record search when the app
 * provides it. A modal dialog with a labelled combobox; arrows move, Enter opens, Escape closes
 * and returns focus to where it was.
 */
export function CommandPalette({
  open,
  onOpenChange,
  commands,
  search,
  navigate,
  placeholder = "Search pages and records…",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  commands: readonly StaffCommand[];
  search?: StaffCommandSearch;
  navigate: (href: string) => void;
  placeholder?: string;
}) {
  const [query, setQuery] = React.useState("");
  const returnFocus = useReturnFocus(open);
  const [results, setResults] = React.useState<readonly StaffCommand[]>([]);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  React.useEffect(() => {
    const trimmed = query.trim();
    if (!search || !open || trimmed.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const timer = window.setTimeout(() => {
      search(trimmed)
        .then((found) => {
          if (!cancelled) setResults(found);
        })
        .catch(() => {
          if (!cancelled) setResults([]);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 180);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [search, open, query]);

  const run = (command: StaffCommand) => {
    onOpenChange(false);
    if (command.onSelect) command.onSelect();
    else if (command.href) navigate(command.href);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        {...STAFF_LAYER}
        overlayClassName="bg-staff-scrim"
        closeClassName="hidden"
        onCloseAutoFocus={returnFocus}
        className="top-[12vh] w-[calc(100%-2rem)] max-w-[640px] translate-y-0 gap-0 overflow-hidden rounded-staff-lg border border-staff-line bg-staff-raised p-0 text-staff-fg shadow-staff-lg sm:rounded-staff-lg"
      >
        <DialogTitle className="sr-only">Search and go to</DialogTitle>
        <DialogDescription className="sr-only">
          Type to find a page or a record, then press Enter to open it.
        </DialogDescription>
        <Command className={`${staffCommandClass} [&_[data-slot=command-input-wrapper]]:h-12`} loop>
          <CommandInput
            placeholder={placeholder}
            value={query}
            onValueChange={setQuery}
            aria-label="Search pages and records"
          />
          <CommandList className="max-h-[min(420px,60vh)] p-1.5">
            <CommandEmpty className="px-3 py-8 text-center text-staff-sm text-staff-muted">
              {loading ? "Searching…" : `No results for “${query.trim()}”.`}
            </CommandEmpty>
            {loading ? (
              <div className="flex items-center gap-2 px-2 py-2 text-staff-xs text-staff-muted">
                <LoaderCircle aria-hidden className="size-3.5 animate-spin" />
                Searching records…
              </div>
            ) : null}
            {groupCommands([...results, ...commands]).map(([group, items]) => (
              <CommandGroup key={group} heading={group} className="p-0">
                {items.map((command) => {
                  const Icon = command.icon;
                  return (
                    <CommandItem
                      key={command.id}
                      value={`${command.label} ${command.hint ?? ""} ${(command.keywords ?? []).join(" ")} ${command.id}`}
                      onSelect={() => run(command)}
                      className={`${staffCommandItemClass} group/item`}
                    >
                      {Icon ? <Icon aria-hidden /> : null}
                      <span className="min-w-0 flex-1 truncate">{command.label}</span>
                      {command.hint ? (
                        <span className="truncate text-staff-xs text-staff-muted">
                          {command.hint}
                        </span>
                      ) : null}
                      <CornerDownLeft
                        aria-hidden
                        className="hidden size-3.5 text-staff-subtle group-data-[selected=true]/item:block"
                      />
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            ))}
          </CommandList>
          <div className="flex items-center gap-4 border-t border-staff-line px-3 py-2 text-staff-xs text-staff-muted">
            <span className="flex items-center gap-1.5">
              <Kbd>↑</Kbd>
              <Kbd>↓</Kbd> to move
            </span>
            <span className="flex items-center gap-1.5">
              <Kbd>↵</Kbd> to open
            </span>
            <span className="flex items-center gap-1.5">
              <Kbd>esc</Kbd> to close
            </span>
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
