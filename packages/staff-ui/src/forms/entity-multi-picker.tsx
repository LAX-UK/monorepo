"use client";

import { useField } from "@auction/ui/lax";
import { X } from "lucide-react";
import * as React from "react";
import { type EntityOption, EntityPicker } from "./entity-picker.js";

export type EntityMultiPickerProps = {
  /** The chosen records' ids, in the order they were added. */
  value: readonly string[];
  onValueChange: (ids: string[]) => void;
  options: readonly EntityOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  /** Most that can be chosen; the picker hides once it is reached. */
  max?: number;
  id?: string;
};

/**
 * Several records chosen by name (categories, tags): the chosen ones as removable chips, then a
 * picker to add another. Options already chosen are left out of the picker.
 */
export function EntityMultiPicker({
  value,
  onValueChange,
  options,
  placeholder = "Add…",
  searchPlaceholder = "Search…",
  emptyText = "No matches.",
  disabled,
  max,
  id,
}: EntityMultiPickerProps) {
  const field = useField();
  const isDisabled = disabled ?? field?.disabled ?? false;
  const byId = React.useMemo(
    () => new Map(options.map((option) => [option.id, option])),
    [options],
  );
  const remaining = options.filter((option) => !value.includes(option.id));
  const full = max !== undefined && value.length >= max;

  return (
    <div className="flex min-w-0 flex-col gap-2">
      {value.length > 0 ? (
        <ul aria-label="Chosen" className="flex flex-wrap gap-1.5">
          {value.map((chosen) => {
            const option = byId.get(chosen);
            const label = option?.label ?? "Unknown";
            return (
              <li
                key={chosen}
                className="inline-flex h-7 items-center gap-1 rounded-staff-sm border border-staff-line-strong bg-staff-surface pr-0.5 pl-2 text-staff-sm text-staff-fg"
              >
                <span className="truncate">{label}</span>
                <button
                  type="button"
                  disabled={isDisabled}
                  aria-label={`Remove ${label}`}
                  onClick={() => onValueChange(value.filter((item) => item !== chosen))}
                  className="staff-focus inline-flex size-6 items-center justify-center rounded-staff-xs text-staff-muted hover:staff-overlay-hover hover:text-staff-fg disabled:cursor-not-allowed"
                >
                  <X aria-hidden className="size-3.5" />
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
      {full ? null : (
        <EntityPicker
          value={null}
          options={remaining}
          placeholder={placeholder}
          searchPlaceholder={searchPlaceholder}
          emptyText={emptyText}
          disabled={isDisabled}
          {...(id ? { id } : {})}
          onValueChange={(option) => {
            if (option) onValueChange([...value, option.id]);
          }}
        />
      )}
    </div>
  );
}
