"use client";

import {
  type GrantableStaffRole,
  STAFF_ROLE_OPTIONS,
  isGrantableRole,
} from "@/server/domain/staff-directory.vm";
import { ChoiceRow, Field, StaffRadio, StaffRadioGroup } from "@auction/staff-ui";
import { useId } from "react";

/**
 * The LAX Admin roles as a list of choices, each saying in plain words what it lets the person
 * see and do, so the grant is never a bare role name. The person's current role is marked.
 */
export function StaffRolePicker({
  value,
  onChange,
  current = null,
  error,
  disabled = false,
  id,
}: {
  value: GrantableStaffRole | null;
  onChange: (role: GrantableStaffRole) => void;
  current?: GrantableStaffRole | null;
  error?: string | null;
  disabled?: boolean;
  id?: string;
}) {
  const ids = useId();
  const groupId = id ?? `${ids}-role`;
  return (
    <Field
      label="Role"
      id={groupId}
      description="What they can see and do in LAX Admin."
      error={error ?? null}
      disabled={disabled}
    >
      <StaffRadioGroup
        id={groupId}
        value={value ?? ""}
        disabled={disabled}
        onValueChange={(next) => {
          if (isGrantableRole(next)) onChange(next);
        }}
      >
        {STAFF_ROLE_OPTIONS.map((option) => (
          <ChoiceRow
            key={option.value}
            htmlFor={`${ids}-${option.value}`}
            label={option.value === current ? `${option.label} (current role)` : option.label}
            description={option.description}
            disabled={disabled}
            control={<StaffRadio id={`${ids}-${option.value}`} value={option.value} />}
          />
        ))}
      </StaffRadioGroup>
    </Field>
  );
}
