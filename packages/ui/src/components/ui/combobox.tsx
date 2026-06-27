"use client";

import { CheckIcon, ChevronsUpDownIcon } from "lucide-react";
import * as React from "react";

import { cn } from "../../lib/utils.js";
import { Button } from "./button.js";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "./command.js";
import { ResponsivePickerShell } from "./responsive-picker-shell.js";

export type ComboboxOption = {
  value: string;
  label: string;
  keywords?: string;
  /** Compact trigger label (e.g. dial code "+44" while dropdown keeps full country name). */
  shortLabel?: string;
};

export type ComboboxProps = {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  options: ComboboxOption[];
  disabled?: boolean;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyLabel?: string;
  className?: string;
  /** When true, trigger shows `shortLabel` (if set) instead of full `label`. */
  compact?: boolean;
  /** Override popover panel width (desktop). Defaults from `compact`. */
  popoverContentClassName?: string;
  /** Accessible name for the trigger when no visible label is tied to the combobox id. */
  "aria-label"?: string;
  id?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
  "aria-busy"?: boolean;
};

function Combobox({
  value,
  onChange,
  onBlur,
  options,
  disabled,
  placeholder = "Select…",
  searchPlaceholder = "Search…",
  emptyLabel = "No results.",
  className,
  compact = false,
  popoverContentClassName: popoverContentClassNameProp,
  id,
  "aria-label": ariaLabel,
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedBy,
  "aria-busy": ariaBusy,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const selected = options.find((o) => o.value === value);
  const triggerLabel =
    compact && selected?.shortLabel ? selected.shortLabel : (selected?.label ?? placeholder);

  const trigger = (
    <Button
      id={id}
      type="button"
      variant={compact ? "ghost" : "outline"}
      // biome-ignore lint/a11y/useSemanticElements: searchable popover combobox; native select cannot host Command list
      role="combobox"
      aria-expanded={open}
      aria-invalid={ariaInvalid}
      aria-label={ariaLabel}
      aria-describedby={ariaDescribedBy}
      aria-busy={ariaBusy}
      disabled={disabled}
      onBlur={onBlur}
      className={cn(
        compact
          ? "h-auto min-h-0 w-auto shrink-0 justify-start gap-0.5 rounded-none px-0 py-0 font-footer-links text-base font-normal shadow-none hover:bg-transparent"
          : "min-h-11 w-full justify-between px-3 py-3 font-body text-sm font-normal",
        !selected && "text-on-surface-variant",
        className,
      )}
    >
      {triggerLabel}
      <ChevronsUpDownIcon
        className={cn("shrink-0 opacity-50", compact ? "ml-0.5 size-3.5" : "ml-2 size-4")}
      />
    </Button>
  );

  const panel = (
    <Command>
      <CommandInput placeholder={searchPlaceholder} />
      <CommandList>
        <CommandEmpty>{emptyLabel}</CommandEmpty>
        <CommandGroup>
          {options.map((option) => (
            <CommandItem
              key={option.value}
              value={`${option.label} ${option.keywords ?? ""}`.trim()}
              onSelect={() => {
                onChange(option.value);
                setOpen(false);
              }}
            >
              <CheckIcon
                className={cn("mr-2 size-4", value === option.value ? "opacity-100" : "opacity-0")}
              />
              {option.label}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </Command>
  );

  const popoverContentClassName =
    popoverContentClassNameProp ??
    (compact
      ? "min-w-[280px] w-[min(100vw-2rem,320px)] p-0"
      : "w-[var(--radix-popover-trigger-width)] p-0");

  return (
    <ResponsivePickerShell
      open={open}
      onOpenChange={setOpen}
      trigger={trigger}
      panel={panel}
      sheetTitle={placeholder}
      popoverContentClassName={popoverContentClassName}
    />
  );
}

export { Combobox };
