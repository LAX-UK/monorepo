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
import { Check, ChevronsUpDown, Info, LoaderCircle, Lock } from "lucide-react";
import * as React from "react";
import { STAFF_LAYER, cn } from "../lib/cn.js";
import { StaffButton } from "../primitives/button.js";
import { staffCommandClass, staffCommandItemClass } from "./command-styles.js";

export type EntityOption = {
  id: string;
  /** What staff recognise it by: a title, a name, an order number. */
  label: string;
  /** A second line that tells similar options apart: an email, an artist, an edition. */
  description?: string;
  /** Right-aligned detail, e.g. a status or a price. */
  meta?: React.ReactNode;
  /** Drawn before the label, in the list and in the closed control: a thumbnail. */
  leading?: React.ReactNode;
  /**
   * The option cannot be chosen, and this says why in the lock's own words. It stays in the list
   * as unavailable (skipped by the arrow keys, as every disabled option is), with the reason
   * always visible under it, read with the option, and never hidden behind a hover.
   */
  disabledReason?: string;
  /** A line of context under a choosable option, such as a draft that cannot be published while it is held. */
  note?: string;
  /** A heading above the first of a run of options that share it ("Can be held"). */
  group?: string;
  /** Unavailable with no reason to give: skipped by the arrow keys and read as unavailable. */
  disabled?: boolean;
};

export type EntityPickerProps = {
  value: string | null;
  onValueChange: (option: EntityOption | null) => void;
  /** Options known up front (e.g. an order's lines). */
  options?: readonly EntityOption[];
  /**
   * Ranks and filters `options` itself as staff type, instead of the default fuzzy match: for a
   * long fixed list where the order of matches matters (a time zone list that leads with the
   * usual cities).
   */
  filter?: (options: readonly EntityOption[], query: string) => readonly EntityOption[];
  /** Or search the server as staff type; called with the trimmed query (may be empty). */
  search?: (query: string) => Promise<readonly EntityOption[]>;
  /**
   * Shows the chosen option's second line in the closed control only from the `sm` breakpoint up,
   * so a long label is never cut off on a phone. The list always shows it.
   */
  triggerDescriptionFromSm?: boolean;
  /** The chosen option's display, when it is not in `options` (e.g. loaded with the record). */
  selected?: EntityOption | null;
  placeholder?: string;
  searchPlaceholder?: string;
  /** Shown when nothing matches; a function receives what was typed. */
  emptyText?: React.ReactNode | ((query: string) => React.ReactNode);
  /** Shown while a server search runs. */
  searchingText?: string;
  /** Shown, with a Try again button, when the server search fails. */
  searchErrorText?: React.ReactNode;
  /** A note under the list, such as what the list leaves out. */
  footer?: React.ReactNode;
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
  filter,
  search,
  selected,
  triggerDescriptionFromSm = false,
  placeholder = "Choose…",
  searchPlaceholder = "Search…",
  emptyText = "No matches.",
  searchingText = "Searching…",
  searchErrorText = "Couldn't search. Try again in a moment.",
  footer,
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
  const [failed, setFailed] = React.useState(false);
  const [attempt, setAttempt] = React.useState(0);

  React.useEffect(() => {
    if (!search || !open) return;
    let cancelled = false;
    setLoading(true);
    setFailed(false);
    void attempt;
    const timer = window.setTimeout(() => {
      search(query.trim())
        .then((results) => {
          if (!cancelled) setRemote(results);
        })
        .catch(() => {
          if (!cancelled) {
            setRemote([]);
            setFailed(true);
          }
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 200);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [search, open, query, attempt]);

  const list = search ? (remote ?? []) : filter ? filter(options, query) : options;
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
            "staff-focus staff-target justify-between text-left text-staff-md",
            current?.leading ? "min-h-control-lg py-1" : "h-control-md",
            "aria-invalid:border-staff-danger disabled:cursor-not-allowed disabled:border-staff-line disabled:bg-staff-sunken disabled:text-staff-disabled",
            "data-[state=open]:border-staff-control-border-hover",
            className,
          )}
        >
          {current ? (
            <TriggerValue option={current} fromSm={triggerDescriptionFromSm} />
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
        <Command shouldFilter={!search && !filter} className={staffCommandClass}>
          <CommandInput
            placeholder={searchPlaceholder}
            value={query}
            onValueChange={setQuery}
            aria-label={searchPlaceholder}
          />
          <CommandList id={listId} className="max-h-72 p-1">
            {loading ? (
              <output className="flex items-center gap-2 px-2 py-3 text-staff-sm text-staff-muted">
                <LoaderCircle aria-hidden className="size-4 animate-spin" />
                {searchingText}
              </output>
            ) : failed ? (
              <div role="alert" className="flex flex-col items-start gap-2 px-2 py-4 text-staff-sm">
                <p className="text-staff-fg">{searchErrorText}</p>
                <StaffButton size="sm" variant="secondary" onClick={() => setAttempt((n) => n + 1)}>
                  Try again
                </StaffButton>
              </div>
            ) : (
              <CommandEmpty className="px-2 py-6 text-center text-staff-sm text-staff-muted">
                {typeof emptyText === "function" ? emptyText(query.trim()) : emptyText}
              </CommandEmpty>
            )}
            {loading || failed ? null : (
              <OptionGroups
                options={list}
                value={value}
                listId={listId}
                onPick={(option) => {
                  onValueChange(option.id === value ? null : option);
                  setOpen(false);
                }}
              />
            )}
          </CommandList>
          {footer && !loading && !failed ? (
            <div className="flex items-start gap-2 border-t border-staff-line px-3 py-2 text-staff-xs text-staff-muted">
              <Info aria-hidden className="mt-px size-3.5 shrink-0" />
              <span>{footer}</span>
            </div>
          ) : null}
        </Command>
      </PopoverContent>
    </Popover>
  );
}

/** The chosen option in the closed control: its label and second line, with its thumbnail if any. */
function TriggerValue({ option, fromSm }: { option: EntityOption; fromSm: boolean }) {
  const description = option.description ? (
    <span className={cn("truncate text-staff-sm text-staff-muted", fromSm && "hidden sm:inline")}>
      {option.description}
    </span>
  ) : null;
  if (option.leading) {
    return (
      <span className="flex min-w-0 items-center gap-2.5">
        {option.leading}
        <span className="flex min-w-0 flex-col">
          <span className="truncate">{option.label}</span>
          {description}
        </span>
      </span>
    );
  }
  return (
    <span className="flex min-w-0 items-baseline gap-2">
      <span className="truncate">{option.label}</span>
      {description}
    </span>
  );
}

/** The options, in the order given, with a heading where a new group starts. */
function OptionGroups({
  options,
  value,
  listId,
  onPick,
}: {
  options: readonly EntityOption[];
  value: string | null;
  listId: string;
  onPick: (option: EntityOption) => void;
}) {
  const runs: { heading: string | undefined; items: EntityOption[] }[] = [];
  for (const option of options) {
    const last = runs[runs.length - 1];
    if (last && last.heading === option.group) last.items.push(option);
    else runs.push({ heading: option.group, items: [option] });
  }
  return (
    <>
      {runs.map((run, index) => (
        <CommandGroup
          // biome-ignore lint/suspicious/noArrayIndexKey: runs are positional and rebuilt with the list
          key={index}
          {...(run.heading ? { heading: run.heading } : {})}
          className="p-0"
        >
          {run.items.map((option) => (
            <OptionRow
              key={option.id}
              option={option}
              selected={option.id === value}
              listId={listId}
              onPick={onPick}
            />
          ))}
        </CommandGroup>
      ))}
    </>
  );
}

function OptionRow({
  option,
  selected,
  listId,
  onPick,
}: {
  option: EntityOption;
  selected: boolean;
  listId: string;
  onPick: (option: EntityOption) => void;
}) {
  const reasonId = `${listId}-${option.id}-why`;
  const locked = option.disabledReason !== undefined;
  return (
    <CommandItem
      value={`${option.label} ${option.description ?? ""} ${option.id}`}
      disabled={locked || (option.disabled ?? false)}
      aria-describedby={locked ? reasonId : undefined}
      onSelect={() => onPick(option)}
      className={cn(
        staffCommandItemClass,
        // A locked option stays readable: its title is muted, never faded out.
        locked && "cursor-not-allowed items-start data-[disabled=true]:text-staff-muted",
      )}
    >
      <div className="flex w-full min-w-0 items-start gap-2.5">
        {option.leading ?? (
          <Check
            aria-hidden
            className={cn("shrink-0 self-center", selected ? "opacity-100" : "opacity-0")}
          />
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate">{option.label}</span>
              {option.description ? (
                <span className="truncate text-staff-xs text-staff-muted max-sm:whitespace-normal">
                  {option.description}
                </span>
              ) : null}
            </span>
            {option.meta ? (
              <span className="shrink-0 text-staff-xs text-staff-muted max-sm:basis-full">
                {option.meta}
              </span>
            ) : null}
          </div>
          {!locked && option.note ? (
            <p className="flex gap-1.5 text-staff-xs text-staff-muted">
              <Info aria-hidden className="mt-px size-3.5 shrink-0" />
              <span>{option.note}</span>
            </p>
          ) : null}
          {locked ? (
            <p id={reasonId} className="flex gap-1.5 text-staff-xs text-staff-muted">
              <Lock aria-hidden className="mt-px size-3.5 shrink-0" />
              <span>{option.disabledReason}</span>
            </p>
          ) : null}
        </div>
      </div>
    </CommandItem>
  );
}
