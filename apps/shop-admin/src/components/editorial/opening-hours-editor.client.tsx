"use client";

import { SelectField } from "@/components/forms/fields";
import { useFieldControlId } from "@/components/forms/form-field";
import {
  type DayHours,
  type DayState,
  type OpeningHoursForm,
  WEEKDAYS,
  emptyOpeningHoursForm,
  weekToRows,
} from "@/lib/editorial-opening-hours";
import { Button, Label, TimePicker } from "@auction/ui";
import { useId } from "react";

const STATE_OPTIONS: Array<{ value: DayState; label: string }> = [
  { value: "unlisted", label: "Not listed" },
  { value: "open", label: "Open" },
  { value: "closed", label: "Closed" },
];

function DayRow({
  name,
  day,
  disabled,
  onChange,
}: {
  name: string;
  day: DayHours;
  disabled: boolean;
  onChange: (next: DayHours) => void;
}) {
  return (
    <li className="grid grid-cols-[3rem_1fr] items-end gap-3 sm:grid-cols-[3rem_10rem_1fr]">
      <span className="pb-2 text-sm font-medium">{name}</span>
      <SelectField
        label={`${name} status`}
        value={day.state}
        options={STATE_OPTIONS}
        disabled={disabled}
        onChange={(state) => onChange({ ...day, state })}
      />
      {day.state === "open" ? (
        <div className="col-span-2 flex items-end gap-2 sm:col-span-1">
          <TimeInput
            label={`${name} opens`}
            value={day.opens}
            disabled={disabled}
            onChange={(opens) => onChange({ ...day, opens })}
          />
          <span className="pb-2 text-sm text-on-surface-variant" aria-hidden>
            to
          </span>
          <TimeInput
            label={`${name} closes`}
            value={day.closes}
            disabled={disabled}
            onChange={(closes) => onChange({ ...day, closes })}
          />
        </div>
      ) : null}
    </li>
  );
}

function TimeInput({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  const id = useId();
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <TimePicker id={id} value={value} disabled={disabled} onChange={onChange} />
    </div>
  );
}

/**
 * Opening hours per weekday. Days with the same hours are written as one row ("Tue – Sat"), the
 * way the public page prints them. Hours the editor cannot show are kept as they are until
 * staff choose to start again.
 */
export function OpeningHoursEditor({
  value,
  error,
  disabled,
  onChange,
}: {
  value: OpeningHoursForm;
  error: string | undefined;
  disabled: boolean;
  onChange: (next: OpeningHoursForm) => void;
}) {
  const headingId = useId();
  const controlId = useFieldControlId("openingHours");
  const errorId = `${headingId}-error`;

  if (value.mode === "unrecognised") {
    return (
      <div className="space-y-3 rounded-md border border-border-hairline p-4 sm:col-span-2">
        <p id={headingId} className="text-sm font-medium">
          Opening hours
        </p>
        <p className="text-sm text-on-surface-variant">
          The stored hours are in a format the weekly editor cannot show, so they are kept as they
          are. Replace them to edit day by day.
        </p>
        <pre className="overflow-x-auto rounded bg-surface-container-low p-3 text-xs">
          {JSON.stringify(value.stored, null, 2)}
        </pre>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          onClick={() => onChange(emptyOpeningHoursForm())}
        >
          Replace with weekly hours
        </Button>
      </div>
    );
  }

  const rows = weekToRows(value.days);
  return (
    <fieldset
      id={controlId}
      tabIndex={-1}
      className="space-y-3 sm:col-span-2"
      aria-describedby={error ? errorId : undefined}
      aria-labelledby={headingId}
    >
      <legend id={headingId} className="text-sm font-medium">
        Opening hours
      </legend>
      <ul className="space-y-2">
        {WEEKDAYS.map((name, index) => {
          const day = value.days[index];
          if (!day) return null;
          return (
            <DayRow
              key={name}
              name={name}
              day={day}
              disabled={disabled}
              onChange={(next) =>
                onChange({
                  mode: "days",
                  days: value.days.map((existing, at) => (at === index ? next : existing)),
                })
              }
            />
          );
        })}
      </ul>
      {error ? (
        <p id={errorId} className="text-xs font-medium text-error">
          {error}
        </p>
      ) : null}
      <p className="text-xs text-on-surface-variant">
        {rows.length === 0
          ? "No opening hours are shown on lax.art."
          : `Shown on lax.art as: ${rows.map((row) => `${row.label} ${row.hours}`).join("; ")}`}
      </p>
    </fieldset>
  );
}
