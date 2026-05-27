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
  id,
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedBy,
  "aria-busy": ariaBusy,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const selected = options.find((o) => o.value === value);

  const trigger = (
    <Button
      id={id}
      type="button"
      variant="outline"
      // biome-ignore lint/a11y/useSemanticElements: searchable popover combobox; native select cannot host Command list
      role="combobox"
      aria-expanded={open}
      aria-invalid={ariaInvalid}
      aria-describedby={ariaDescribedBy}
      aria-busy={ariaBusy}
      disabled={disabled}
      onBlur={onBlur}
      className={cn(
        "min-h-11 w-full justify-between px-3 py-3 font-body text-sm font-normal",
        !selected && "text-on-surface-variant",
        className,
      )}
    >
      {selected?.label ?? placeholder}
      <ChevronsUpDownIcon className="ml-2 size-4 shrink-0 opacity-50" />
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

  return (
    <ResponsivePickerShell
      open={open}
      onOpenChange={setOpen}
      trigger={trigger}
      panel={panel}
      sheetTitle={placeholder}
      popoverContentClassName="w-[var(--radix-popover-trigger-width)] p-0"
    />
  );
}

export { Combobox };
