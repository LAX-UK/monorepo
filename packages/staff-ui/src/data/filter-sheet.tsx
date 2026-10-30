"use client";

import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@auction/ui/components/sheet";
import { Count, Field, TextInput, useReturnFocus } from "@auction/ui/lax";
import { ListFilter, X } from "lucide-react";
import * as React from "react";
import { type EntityOption, EntityPicker } from "../forms/entity-picker.js";
import { STAFF_LAYER, cn } from "../lib/cn.js";
import { StaffButton } from "../primitives/button.js";
import { ChoiceRow, StaffCheckbox, StaffRadio, StaffRadioGroup } from "../primitives/choice.js";
import { useStaffShortcut } from "../shell/shortcuts.js";
import {
  DEFAULT_DATE_PRESETS,
  type DateRangePreset,
  type DayRange,
  londonToday,
} from "./date-range-filter.js";
import type { FilterOption } from "./toolbar.js";

/** Pick any number of values: "Status is Pending or Authorised". */
export type FilterChecklistSection = {
  kind: "checklist";
  id: string;
  label: string;
  options: readonly FilterOption[];
  value: readonly string[];
};

/** Pick one value or none: "Hold reason". */
export type FilterRadioSection = {
  kind: "radio";
  id: string;
  label: string;
  options: readonly FilterOption[];
  /** "" when nothing is chosen. */
  value: string;
  /** The label of the "no filter" choice; defaults to "Any". */
  anyLabel?: string;
};

/** Whole London days, from and to (`YYYY-MM-DD`), with presets. */
export type FilterDateRangeSection = {
  kind: "date-range";
  id: string;
  label: string;
  value: DayRange;
  presets?: readonly DateRangePreset[];
};

/**
 * One record chosen by name, for lists too long for radios (a sale, an artist, a seller): a
 * searchable picker over `options`, or over the server with `search`.
 */
export type FilterEntitySection = {
  kind: "entity";
  id: string;
  label: string;
  /** The record's id, or "" when nothing is chosen. */
  value: string;
  options?: readonly EntityOption[];
  search?: (query: string) => Promise<readonly EntityOption[]>;
  /** The chosen record's display when it is not among `options` (a server search). */
  selected?: EntityOption | null;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
};

export type FilterSheetSection =
  | FilterChecklistSection
  | FilterRadioSection
  | FilterDateRangeSection
  | FilterEntitySection;

/** The applied value of each section, by section id. */
export type FilterSheetValues = Record<string, readonly string[] | string | DayRange>;

function valuesOf(sections: readonly FilterSheetSection[]): FilterSheetValues {
  return Object.fromEntries(sections.map((section) => [section.id, section.value]));
}

function isActive(section: FilterSheetSection, value: FilterSheetValues[string] | undefined) {
  if (value === undefined) return false;
  switch (section.kind) {
    case "checklist":
      return (value as readonly string[]).length > 0;
    case "radio":
    case "entity":
      return value !== "";
    case "date-range": {
      const range = value as DayRange;
      return Boolean(range.from || range.to);
    }
  }
}

function emptyValue(section: FilterSheetSection): FilterSheetValues[string] {
  switch (section.kind) {
    case "checklist":
      return [];
    case "radio":
    case "entity":
      return "";
    case "date-range":
      return { from: "", to: "" };
  }
}

/**
 * One "Filter" button that opens a sheet holding every filter for the list. Choices are staged
 * until "Apply", so a list served from the server refetches once, not on every tick. The button
 * shows how many filters are on; the applied ones show as removable chips under the toolbar
 * (`ActiveFilterChips`), which is where they are removed one at a time.
 */
export function FilterSheet({
  sections,
  onApply,
  title = "Filters",
  description,
  today,
}: {
  sections: readonly FilterSheetSection[];
  onApply: (values: FilterSheetValues) => void;
  title?: string;
  description?: React.ReactNode;
  /** Overrides the current London day for date presets, for tests. */
  today?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const filterButtonRef = React.useRef<HTMLButtonElement>(null);
  const returnFocus = useReturnFocus(open, () => filterButtonRef.current);
  const [draft, setDraft] = React.useState<FilterSheetValues>(() => valuesOf(sections));
  const applied = valuesOf(sections);
  const activeCount = sections.filter((section) => isActive(section, applied[section.id])).length;
  const draftActive = sections.some((section) => isActive(section, draft[section.id]));
  const idBase = React.useId();

  const openSheet = (next: boolean) => {
    if (next) setDraft(valuesOf(sections));
    setOpen(next);
  };
  const set = (id: string, value: FilterSheetValues[string]) =>
    setDraft((current) => ({ ...current, [id]: value }));
  const apply = () => {
    onApply(draft);
    setOpen(false);
  };
  const clearAll = () =>
    setDraft(Object.fromEntries(sections.map((section) => [section.id, emptyValue(section)])));
  useStaffShortcut({
    id: "staff:open-list-filters",
    keys: "f",
    label: "Open filters",
    group: "Lists",
    handler: () => openSheet(true),
  });

  return (
    <>
      <StaffButton
        ref={filterButtonRef}
        size="sm"
        variant="secondary"
        icon={<ListFilter aria-hidden />}
        aria-haspopup="dialog"
        aria-keyshortcuts="f"
        aria-expanded={open}
        onClick={() => openSheet(true)}
        className={cn(activeCount > 0 && "border-staff-line-hover")}
      >
        Filter
        {activeCount > 0 ? <Count value={activeCount} className="-mr-1" /> : null}
      </StaffButton>
      <Sheet open={open} onOpenChange={openSheet}>
        <SheetContent
          {...STAFF_LAYER}
          side="right"
          overlayClassName="bg-staff-scrim"
          onCloseAutoFocus={returnFocus}
          className="flex w-full max-w-none flex-col gap-0 border-l border-staff-line bg-staff-surface p-0 text-staff-fg shadow-staff-lg sm:w-[400px] sm:max-w-none [&>button:last-child]:hidden"
        >
          <form
            className="flex min-h-0 flex-1 flex-col"
            onSubmit={(event) => {
              event.preventDefault();
              apply();
            }}
          >
            <header className="flex items-start gap-3 border-b border-staff-line px-5 py-4">
              <div className="min-w-0 flex-1">
                <SheetTitle className="font-staff text-staff-lg font-semibold text-staff-fg">
                  {title}
                </SheetTitle>
                <SheetDescription
                  className={description ? "mt-0.5 text-staff-sm text-staff-muted" : "sr-only"}
                >
                  {description ?? "Choose filters, then apply them to the list."}
                </SheetDescription>
              </div>
              <SheetClose asChild>
                <StaffButton
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Close filters"
                  className="-mt-1 -mr-2"
                >
                  <X aria-hidden />
                </StaffButton>
              </SheetClose>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4" data-lenis-prevent>
              <div className="flex flex-col divide-y divide-staff-line-subtle">
                {sections.map((section) => (
                  // The spacing sits on a wrapper: a fieldset draws its legend above its own
                  // padding, which would open a gap between the legend and the choices.
                  <div key={section.id} className="py-4 first:pt-0">
                    <fieldset className="flex flex-col gap-1">
                      <legend className="mb-1 text-staff-sm font-medium text-staff-fg">
                        {section.label}
                      </legend>
                      <SectionBody
                        section={section}
                        value={draft[section.id] ?? emptyValue(section)}
                        onChange={(value) => set(section.id, value)}
                        idBase={`${idBase}-${section.id}`}
                        today={today ?? londonToday()}
                      />
                    </fieldset>
                  </div>
                ))}
              </div>
            </div>
            <footer className="flex items-center gap-2 border-t border-staff-line bg-staff-surface px-5 py-3">
              <StaffButton
                type="button"
                variant="ghost"
                size="sm"
                onClick={clearAll}
                {...(draftActive ? {} : { disabledReason: "No filters are on" })}
              >
                Clear all
              </StaffButton>
              <div className="ml-auto flex items-center gap-2">
                <StaffButton type="button" variant="secondary" onClick={() => setOpen(false)}>
                  Cancel
                </StaffButton>
                <StaffButton type="submit" variant="primary">
                  Apply filters
                </StaffButton>
              </div>
            </footer>
          </form>
        </SheetContent>
      </Sheet>
    </>
  );
}

function SectionBody({
  section,
  value,
  onChange,
  idBase,
  today,
}: {
  section: FilterSheetSection;
  value: FilterSheetValues[string];
  onChange: (value: FilterSheetValues[string]) => void;
  idBase: string;
  today: string;
}) {
  if (section.kind === "checklist") {
    const selected = value as readonly string[];
    return (
      <div className="flex flex-col">
        {section.options.map((option) => {
          const id = `${idBase}-${option.value}`;
          return (
            <ChoiceRow
              key={option.value}
              htmlFor={id}
              control={
                <StaffCheckbox
                  id={id}
                  checked={selected.includes(option.value)}
                  onCheckedChange={(checked) =>
                    onChange(
                      checked === true
                        ? [...selected, option.value]
                        : selected.filter((item) => item !== option.value),
                    )
                  }
                />
              }
              label={<OptionLabel option={option} />}
              className="[&>label]:flex-1"
            />
          );
        })}
      </div>
    );
  }
  if (section.kind === "radio") {
    const anyId = `${idBase}-any`;
    return (
      <StaffRadioGroup
        value={value as string}
        onValueChange={(next) => onChange(next)}
        aria-label={section.label}
        className="gap-0"
      >
        <ChoiceRow
          htmlFor={anyId}
          control={<StaffRadio id={anyId} value="" />}
          label={section.anyLabel ?? "Any"}
        />
        {section.options.map((option) => {
          const id = `${idBase}-${option.value}`;
          return (
            <ChoiceRow
              key={option.value}
              htmlFor={id}
              control={<StaffRadio id={id} value={option.value} />}
              label={<OptionLabel option={option} />}
              className="[&>label]:flex-1"
            />
          );
        })}
      </StaffRadioGroup>
    );
  }
  if (section.kind === "entity") {
    return <EntitySectionBody section={section} value={value as string} onChange={onChange} />;
  }
  const range = value as DayRange;
  const presets = section.presets ?? DEFAULT_DATE_PRESETS;
  const setRange = (next: DayRange) =>
    onChange(next.from && next.to && next.from > next.to ? { from: next.to, to: next.from } : next);
  return (
    <div className="flex flex-col gap-3">
      <ul aria-label={`${section.label} presets`} className="flex flex-wrap gap-1.5">
        {presets.map((preset) => {
          const presetRange = preset.range(today);
          const selected = presetRange.from === range.from && presetRange.to === range.to;
          return (
            <li key={preset.id}>
              <StaffButton
                type="button"
                size="sm"
                variant={selected ? "primary" : "secondary"}
                aria-pressed={selected}
                onClick={() => setRange(presetRange)}
              >
                {preset.label}
              </StaffButton>
            </li>
          );
        })}
      </ul>
      <div className="grid grid-cols-2 gap-2">
        <Field label="From" optional>
          <TextInput
            size="sm"
            type="date"
            max={range.to || undefined}
            value={range.from}
            onChange={(event) => setRange({ from: event.target.value, to: range.to })}
          />
        </Field>
        <Field label="To" optional>
          <TextInput
            size="sm"
            type="date"
            min={range.from || undefined}
            value={range.to}
            onChange={(event) => setRange({ from: range.from, to: event.target.value })}
          />
        </Field>
      </div>
    </div>
  );
}

function EntitySectionBody({
  section,
  value,
  onChange,
}: {
  section: FilterEntitySection;
  value: string;
  onChange: (value: string) => void;
}) {
  // A record found by searching is remembered, so the picker keeps showing its name.
  const [chosen, setChosen] = React.useState<EntityOption | null>(section.selected ?? null);
  return (
    <EntityPicker
      value={value || null}
      onValueChange={(option) => {
        setChosen(option);
        onChange(option?.id ?? "");
      }}
      aria-label={section.label}
      {...(section.options ? { options: section.options } : {})}
      {...(section.search ? { search: section.search } : {})}
      selected={chosen}
      placeholder={section.placeholder ?? "Any"}
      {...(section.searchPlaceholder ? { searchPlaceholder: section.searchPlaceholder } : {})}
      {...(section.emptyText ? { emptyText: section.emptyText } : {})}
    />
  );
}

function OptionLabel({ option }: { option: FilterOption }) {
  return (
    <span className="flex w-full items-baseline justify-between gap-3 font-normal">
      <span>{option.label}</span>
      {option.count !== undefined ? (
        <span className="text-staff-xs text-staff-muted tabular-nums">{option.count}</span>
      ) : null}
    </span>
  );
}
