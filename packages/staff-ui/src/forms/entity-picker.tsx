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
import { fieldBox, readOnlyBox, useField } from "@auction/ui/lax";
import { Check, ChevronsUpDown, LoaderCircle } from "lucide-react";
import * as React from "react";
import { STAFF_LAYER, cn } from "../lib/cn.js";
import { staffCommandClass, staffCommandItemClass } from "./command-styles.js";

export type EntityOption = {
  id: string;
  /** What staff recognise it by: a title, a name, an order number. */
  label: string;
  /** A second line that tells similar options apart: an email, an artist, an edition. */
  description?: string;
  /** Right-aligned detail, e.g. a status or a price. */
  meta?: React.ReactNode;
  disabled?: boolean;
};

export type EntityPickerProps = {
  value: string | null;
  onValueChange: (option: EntityOption | null) => void;
  /** Options known up front (e.g. an order's lines). */
  options?: readonly EntityOption[];
  /** Or search the server as staff type; called with the trimmed query (may be empty). */
  search?: (query: string) => Promise<readonly EntityOption[]>;
  /** The chosen option's display, when it is not in `options` (e.g. loaded with the record). */
  selected?: EntityOption | null;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  invalid?: boolean;
  id?: string;
  "aria-label"?: string;
  className?: string;
};

/**
 * Choose a record by what it is called, never by its id. Opens a searchable list (type to filter,
 * arrows to move, Enter to choose, Escape to close); with `search`, results come from the server
 * after a short pause in typing.
 */
export function EntityPicker({
  value,
  onValueChange,
  options = [],
  search,
  selected,
  placeholder = "Choose…",
  searchPlaceholder = "Search…",
  emptyText = "No matches.",
  disabled,
  invalid,
  id,
  className,
  ...aria
}: EntityPickerProps) {
  const field = useField();
  const listId = React.useId();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [remote, setRemote] = React.useState<readonly EntityOption[] | null>(null);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!search || !open) return;
    let cancelled = false;
    setLoading(true);
    const timer = window.setTimeout(() => {
      search(query.trim())
        .then((results) => {
          if (!cancelled) setRemote(results);
        })
        .catch(() => {
          if (!cancelled) setRemote([]);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 200);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [search, open, query]);

  const list = search ? (remote ?? []) : options;
  const current =
    list.find((option) => option.id === value) ??
    options.find((option) => option.id === value) ??
    (selected && selected.id === value ? selected : null);
  const isInvalid = invalid ?? field?.invalid ?? false;
  const isDisabled = disabled ?? field?.disabled ?? false;

  if (field?.readOnly) {
    return (
      <div
        data-readonly=""
        id={id ?? field.controlId}
        // biome-ignore lint/a11y/useSemanticElements: a read-only value, not an editable input
        role="textbox"
        aria-readonly="true"
        tabIndex={0}
        aria-labelledby={field.labelId}
        className={cn(fieldBox, readOnlyBox, "h-control-md text-staff-md", className)}
      >
        <span className="truncate">{current?.label ?? ""}</span>
      </div>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          // biome-ignore lint/a11y/useSemanticElements: the WAI-ARIA select-only combobox pattern; a native select cannot search
          role="combobox"
          aria-controls={listId}
          aria-expanded={open}
          aria-haspopup="listbox"
          id={id ?? field?.controlId}
          disabled={isDisabled}
          aria-invalid={isInvalid || undefined}
          {...(field?.describedBy ? { "aria-describedby": field.describedBy } : {})}
          {...(aria["aria-label"] ? { "aria-label": aria["aria-label"] } : {})}
          className={cn(
            fieldBox,
            "staff-focus staff-target h-control-md justify-between text-left text-staff-md",
            "aria-invalid:border-staff-danger disabled:cursor-not-allowed disabled:border-staff-line disabled:bg-staff-sunken disabled:text-staff-disabled",
            "data-[state=open]:border-staff-control-border-hover",
            className,
          )}
        >
          {current ? (
            <span className="flex min-w-0 items-baseline gap-2">
              <span className="truncate">{current.label}</span>
              {current.description ? (
                <span className="truncate text-staff-sm text-staff-muted">
                  {current.description}
                </span>
              ) : null}
            </span>
          ) : (
            <span className="truncate text-staff-subtle">{placeholder}</span>
          )}
          <ChevronsUpDown aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent
        {...STAFF_LAYER}
        align="start"
        sideOffset={6}
        aria-label={searchPlaceholder}
        className="w-[var(--radix-popover-trigger-width)] min-w-72 rounded-staff-md border border-staff-line bg-staff-raised p-0 text-staff-fg shadow-staff-md"
      >
        <Command shouldFilter={!search} className={staffCommandClass}>
          <CommandInput
            placeholder={searchPlaceholder}
            value={query}
            onValueChange={setQuery}
            aria-label={searchPlaceholder}
          />
          <CommandList id={listId} className="max-h-72 p-1">
            {loading ? (
              <div className="flex items-center gap-2 px-2 py-3 text-staff-sm text-staff-muted">
                <LoaderCircle aria-hidden className="size-4 animate-spin" />
                Searching…
              </div>
            ) : (
              <CommandEmpty className="px-2 py-6 text-center text-staff-sm text-staff-muted">
                {emptyText}
              </CommandEmpty>
            )}
            <CommandGroup className="p-0">
              {list.map((option) => (
                <CommandItem
                  key={option.id}
                  value={`${option.label} ${option.description ?? ""} ${option.id}`}
                  disabled={option.disabled ?? false}
                  onSelect={() => {
                    onValueChange(option.id === value ? null : option);
                    setOpen(false);
                  }}
                  className={staffCommandItemClass}
                >
                  <Check
                    aria-hidden
                    className={cn(option.id === value ? "opacity-100" : "opacity-0")}
                  />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate">{option.label}</span>
                    {option.description ? (
                      <span className="truncate text-staff-xs text-staff-muted">
                        {option.description}
                      </span>
                    ) : null}
                  </span>
                  {option.meta ? (
                    <span className="shrink-0 text-staff-xs text-staff-muted">{option.meta}</span>
                  ) : null}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
