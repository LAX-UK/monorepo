"use client";

import { listZoneChoices, rankZoneChoices, zoneChoiceLabel } from "@auction/datetime";
import { type EntityOption, EntityPicker, Field, StaffReadOnly } from "@auction/staff-ui";
import { useMemo } from "react";
import { type Control, type FieldPath, type FieldValues, useController } from "react-hook-form";
import { staffFieldId } from "./staff-form-fields";

type Props<T extends FieldValues> = {
  control: Control<T>;
  name: FieldPath<T>;
  /** The form's id, which prefixes the control's id. */
  formId: string;
  label: string;
  /** Guidance under the label while the field can be changed. */
  description?: string;
  /** Why the field cannot be changed. Setting it shows the zone read-only with this reason. */
  lockedReason?: string;
};

function toOption(zone: string, now: Date): EntityOption {
  return { id: zone, label: zoneChoiceLabel(zone, now), description: zone };
}

/** A value the list cannot show as a place (blank, UTC, a typo) is shown as it was written. */
function unknownOption(value: string): EntityOption {
  return { id: value, label: value };
}

/**
 * Picks the IANA time zone a record's times are written in, by place ("London (GMT/BST)"). Type
 * to search: a city-name prefix ranks first, the usual cities lead, and the zone name is
 * searchable too. A zone is always chosen: picking the current one again keeps it. When
 * `lockedReason` is set the zone is shown read-only, at normal contrast, with the reason.
 */
export function StaffTimeZoneField<T extends FieldValues>(props: Props<T>) {
  const { field, fieldState } = useController({ control: props.control, name: props.name });
  const id = staffFieldId(props.formId, props.name);
  const value = typeof field.value === "string" && field.value !== "" ? field.value : null;
  const { choices, options } = useMemo(() => {
    const now = new Date();
    const all = listZoneChoices(now);
    return { choices: all, options: all.map((choice) => toOption(choice.zone, now)) };
  }, []);
  const optionById = useMemo(() => new Map(options.map((o) => [o.id, o])), [options]);
  const known = value !== null && optionById.has(value);
  const selected = value && !known ? unknownOption(value) : null;
  const locked = props.lockedReason !== undefined;

  const field_ = (
    <Field
      id={id}
      label={props.label}
      description={locked ? props.lockedReason : props.description}
      error={fieldState.error?.message}
    >
      <EntityPicker
        id={id}
        value={value}
        options={options}
        filter={(_, query) =>
          rankZoneChoices(choices, query).flatMap((choice) => optionById.get(choice.zone) ?? [])
        }
        {...(selected ? { selected } : {})}
        placeholder="Choose a time zone"
        searchPlaceholder="Search by city or zone"
        emptyText="No time zone matches."
        onValueChange={(option) => {
          if (!option) return;
          field.onChange(option.id);
          field.onBlur();
        }}
      />
    </Field>
  );
  return locked ? <StaffReadOnly>{field_}</StaffReadOnly> : field_;
}
