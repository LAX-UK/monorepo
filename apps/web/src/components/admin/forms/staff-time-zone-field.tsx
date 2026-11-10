"use client";

import { listZoneChoices, zoneChoiceLabel } from "@auction/datetime";
import { type EntityOption, EntityPicker, Field } from "@auction/staff-ui";
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
  disabled?: boolean;
  /** Why the field cannot be changed; shown in place of the guidance. */
  lockedReason?: string;
};

function toOption(zone: string, now: Date): EntityOption {
  return { id: zone, label: zoneChoiceLabel(zone, now), description: zone };
}

/**
 * Picks the IANA time zone a record's times are written in, by place ("London (GMT)"). Type to
 * search by city, zone name or abbreviation. A zone is always chosen: picking the current one
 * again keeps it.
 */
export function StaffTimeZoneField<T extends FieldValues>(props: Props<T>) {
  const { field, fieldState } = useController({ control: props.control, name: props.name });
  const id = staffFieldId(props.formId, props.name);
  const value = typeof field.value === "string" && field.value !== "" ? field.value : null;
  const options = useMemo(() => {
    const now = new Date();
    return listZoneChoices(now).map((choice) => toOption(choice.zone, now));
  }, []);
  const selected =
    value && !options.some((option) => option.id === value) ? toOption(value, new Date()) : null;
  const locked = props.disabled === true;

  return (
    <Field
      id={id}
      label={props.label}
      description={locked && props.lockedReason ? props.lockedReason : props.description}
      error={fieldState.error?.message}
      disabled={locked}
    >
      <EntityPicker
        id={id}
        value={value}
        options={options}
        {...(selected ? { selected } : {})}
        disabled={locked}
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
}
