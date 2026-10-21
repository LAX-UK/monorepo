"use client";

import { cn } from "@auction/ui";
import { Checkbox } from "@auction/ui/components/checkbox";
import { Label } from "@auction/ui/components/label";
import { RadioGroup, RadioGroupItem } from "@auction/ui/components/radio-group";

export type MarketingFilterOption = {
  value: string;
  label: string;
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

const rowClass = "flex min-h-11 items-center gap-3";
const labelClass = "flex-1 cursor-pointer py-2 font-body text-sm font-normal text-on-surface";

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
        {options.map((option) => {
          const id = `${idPrefix}-${option.value || "any"}`;
          return (
            <div key={option.value} className={rowClass}>
              <RadioGroupItem id={id} value={option.value} />
              <Label htmlFor={id} className={labelClass}>
                {option.label}
              </Label>
            </div>
          );
        })}
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
          <div key={option.value} className={rowClass}>
            <Checkbox
              id={id}
              checked={checked}
              onCheckedChange={(next) =>
                onChange(
                  next === true
                    ? [...selected, option.value]
                    : selected.filter((value) => value !== option.value),
                )
              }
            />
            <Label htmlFor={id} className={labelClass}>
              {option.label}
            </Label>
          </div>
        );
      })}
    </fieldset>
  );
}
