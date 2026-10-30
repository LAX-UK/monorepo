"use client";

import {
  type AllocationText,
  type RunFormValues,
  allocationTotalText,
  allocationTotals,
  formNumberingText,
  runFieldId,
} from "@/lib/edition-run-form";
import { EDITION_RUN_MAX_SIZE, EDITION_RUN_MIN_SIZE } from "@auction/shop-contracts";
import { ChoiceFieldset, Field, ProgressBar, TextInput, cn } from "@auction/staff-ui";
import { CircleAlert } from "@auction/staff-ui/icons";

const ROWS: ReadonlyArray<{ key: keyof AllocationText; label: string }> = [
  { key: "buyer", label: "Buyers of the original" },
  { key: "artist", label: "Artist" },
  { key: "lax", label: "LAX" },
];

/**
 * A custom run's size and who holds its prints: one row per owner with a number and its share
 * of the size, a live total that turns to the danger colour while prints are left or over, and
 * how the numbers fall (buyers first, then the artist, then LAX).
 */
export function AllocationEditor({
  values,
  errors,
  linkedToOriginal,
  disabled = false,
  onChange,
}: {
  values: RunFormValues;
  errors: { size?: string | undefined; allocation?: string | undefined };
  linkedToOriginal: boolean;
  disabled?: boolean;
  onChange: (patch: Partial<RunFormValues>) => void;
}) {
  const totals = allocationTotals(values);
  const total = allocationTotalText(totals);
  const numbering = formNumberingText(values);
  const size = totals.size ?? 0;
  const setCount = (key: keyof AllocationText, value: string) =>
    onChange({ allocation: { ...values.allocation, [key]: value } });

  return (
    <div className="flex flex-col gap-4">
      <Field
        label="Size"
        description={`${EDITION_RUN_MIN_SIZE} to ${EDITION_RUN_MAX_SIZE} prints`}
        error={errors.size}
        id={runFieldId("size")}
        disabled={disabled}
      >
        <TextInput
          inputMode="numeric"
          autoComplete="off"
          value={values.sizeText}
          trailing={<span className="text-staff-muted">prints</span>}
          boxClassName="sm:max-w-40"
          className="tabular-nums"
          onChange={(event) => onChange({ sizeText: event.target.value })}
        />
      </Field>
      <ChoiceFieldset
        legend="Who holds the prints"
        id={runFieldId("allocation")}
        error={errors.allocation}
        disabled={disabled}
      >
        <ul className="flex flex-col divide-y divide-staff-line-subtle rounded-staff-lg border border-staff-line">
          {ROWS.map((row) => {
            const inputId = `run-allocation-${row.key}`;
            const count = Number(values.allocation[row.key].trim() || 0);
            const needsOriginal = row.key === "buyer" && !linkedToOriginal;
            return (
              <li
                key={row.key}
                className="grid grid-cols-[minmax(0,1fr)_5rem] items-center gap-x-4 gap-y-2 px-3 py-2.5 sm:grid-cols-[minmax(0,12rem)_5rem_minmax(0,1fr)]"
              >
                <label htmlFor={inputId} className="flex min-w-0 flex-col">
                  <span className="text-staff-sm font-medium text-staff-fg">{row.label}</span>
                  {needsOriginal ? (
                    <span className="text-staff-xs text-staff-muted">Needs a linked original</span>
                  ) : null}
                </label>
                <TextInput
                  id={inputId}
                  inputMode="numeric"
                  autoComplete="off"
                  size="sm"
                  value={values.allocation[row.key]}
                  invalid={Boolean(errors.allocation)}
                  className="text-right tabular-nums"
                  onChange={(event) => setCount(row.key, event.target.value)}
                />
                <ProgressBar
                  value={Number.isFinite(count) ? count : 0}
                  max={size}
                  label={`${row.label}: share of the run`}
                  className="col-span-2 sm:col-span-1"
                />
              </li>
            );
          })}
        </ul>
        <p
          aria-live="polite"
          className={cn(
            "flex items-center gap-1.5 text-staff-sm tabular-nums",
            total.complete ? "text-staff-muted" : "font-medium text-staff-danger",
          )}
        >
          {total.complete ? null : <CircleAlert aria-hidden className="size-3.5 shrink-0" />}
          {total.text}
        </p>
      </ChoiceFieldset>
      {numbering ? <p className="text-staff-sm text-staff-muted">{numbering}</p> : null}
    </div>
  );
}
