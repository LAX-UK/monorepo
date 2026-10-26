"use client";

import { editorialFieldId } from "@/components/editorial/editorial-field-parts.client";
import {
  type DayHours,
  type DayState,
  type OpeningHoursForm,
  WEEKDAYS,
  emptyOpeningHoursForm,
  weekToRows,
} from "@/lib/editorial-opening-hours";
import { EnumSelect, Notice, StaffButton, TextArea, TextInput } from "@auction/staff-ui";
import { CircleAlert } from "@auction/staff-ui/icons";
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
    <li className="grid grid-cols-[3rem_minmax(0,1fr)] items-center gap-x-3 gap-y-2 sm:grid-cols-[3rem_10rem_minmax(0,1fr)]">
      <span className="text-staff-sm font-medium text-staff-fg">{name}</span>
      <EnumSelect
        aria-label={`${name} status`}
        value={day.state}
        disabled={disabled}
        options={STATE_OPTIONS}
        onValueChange={(state) => onChange({ ...day, state })}
      />
      {day.state === "open" ? (
        <div className="col-span-2 flex items-center gap-2 sm:col-span-1">
          <TextInput
            inputMode="numeric"
            placeholder="10:00"
            maxLength={5}
            autoComplete="off"
            aria-label={`${name} opens`}
            value={day.opens}
            disabled={disabled}
            boxClassName="sm:max-w-36"
            onChange={(event) => onChange({ ...day, opens: event.target.value })}
          />
          <span className="text-staff-sm text-staff-muted" aria-hidden>
            to
          </span>
          <TextInput
            inputMode="numeric"
            placeholder="18:00"
            maxLength={5}
            autoComplete="off"
            aria-label={`${name} closes`}
            value={day.closes}
            disabled={disabled}
            boxClassName="sm:max-w-36"
            onChange={(event) => onChange({ ...day, closes: event.target.value })}
          />
        </div>
      ) : null}
    </li>
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
  const errorId = `${headingId}-error`;
  const controlId = editorialFieldId("openingHours");

  if (value.mode === "unrecognised") {
    return (
      <div id={controlId} tabIndex={-1} className="flex flex-col gap-3">
        <Notice
          tone="warning"
          title="These hours cannot be edited day by day"
          actions={
            <StaffButton
              type="button"
              size="sm"
              variant="secondary"
              disabled={disabled}
              onClick={() => onChange(emptyOpeningHoursForm())}
            >
              Replace with weekly hours
            </StaffButton>
          }
        >
          The stored hours are in a format the weekly editor cannot show, so they are kept as they
          are until you replace them.
        </Notice>
        <TextArea
          readOnly
          rows={6}
          aria-label="Stored opening hours"
          className="font-mono text-staff-xs"
          value={JSON.stringify(value.stored, null, 2)}
        />
      </div>
    );
  }

  const rows = weekToRows(value.days);
  return (
    <fieldset
      id={controlId}
      tabIndex={-1}
      className="staff-focus flex min-w-0 flex-col gap-3"
      aria-describedby={error ? errorId : undefined}
    >
      <legend className="sr-only">Opening hours by day</legend>
      <ul className="flex flex-col gap-2">
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
        <p
          id={errorId}
          className="flex items-start gap-1.5 text-staff-xs font-medium text-staff-danger"
        >
          <CircleAlert aria-hidden className="mt-px size-3.5 shrink-0" />
          {error}
        </p>
      ) : null}
      <p className="text-staff-sm text-staff-muted">
        {rows.length === 0
          ? "No opening hours are shown on lax.art."
          : `Shown on lax.art as: ${rows.map((row) => `${row.label} ${row.hours}`).join("; ")}`}
      </p>
    </fieldset>
  );
}
