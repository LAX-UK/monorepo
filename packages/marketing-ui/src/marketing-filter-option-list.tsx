"use client";

import { cn } from "@auction/ui";
import { RadioGroup } from "@auction/ui/components/radio-group";
import { MarketingFilterCheckboxRow } from "./marketing-filter-checkbox-row.js";
import { MarketingFilterRadioRow } from "./marketing-filter-radio-row.js";

export type MarketingFilterOption = {
  value: string;
  label: string;
  /** Works the option would give with the other filters; absent when counts are not offered. */
  count?: number | undefined;
};

/**
 * `multiple` renders checkboxes (any of); `single` renders a radio group for facets the API
 * accepts only one value for, or for mutually exclusive choices such as sort order.
 */
export type MarketingFilterSelection = "multiple" | "single";

export type MarketingFilterOptionListProps = {
  /** Accessible name of the group (the facet title). */
  legend: string;
  options: readonly MarketingFilterOption[];
  selected: readonly string[];
  onChange: (next: string[]) => void;
  selection?: MarketingFilterSelection;
  /** Keeps ids unique when the same facet renders in a dropdown and a drawer. */
  idPrefix: string;
  className?: string;
};

/** Checkbox or radio list shared by toolbar dropdowns and drawer facet groups. */
export function MarketingFilterOptionList({
  legend,
  options,
  selected,
  onChange,
  selection = "multiple",
  idPrefix,
  className,
}: MarketingFilterOptionListProps) {
  if (selection === "single") {
    return (
      <RadioGroup
        aria-label={legend}
        value={selected[0] ?? ""}
        onValueChange={(value) => onChange([value])}
        className={cn("gap-0", className)}
      >
        {options.map((option) => (
          <MarketingFilterRadioRow
            key={option.value}
            id={`${idPrefix}-${option.value || "any"}`}
            value={option.value}
            label={option.label}
            count={option.count}
            checked={option.value === (selected[0] ?? "")}
          />
        ))}
      </RadioGroup>
    );
  }

  return (
    <fieldset className={cn("flex min-w-0 flex-col border-0 p-0", className)}>
      <legend className="sr-only">{legend}</legend>
      {options.map((option) => {
        const id = `${idPrefix}-${option.value}`;
        const checked = selected.includes(option.value);
        return (
          <MarketingFilterCheckboxRow
            key={option.value}
            id={id}
            label={option.label}
            count={option.count}
            checked={checked}
            onCheckedChange={(next) =>
              onChange(
                next
                  ? [...selected, option.value]
                  : selected.filter((value) => value !== option.value),
              )
            }
          />
        );
      })}
    </fieldset>
  );
}
