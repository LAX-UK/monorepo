"use client";

import { ChoiceRow, EnumSelect, Field, StaffCheckbox, useStaffField } from "@auction/staff-ui";
import {
  LAX_STAFF_PLATFORMS,
  type LaxStaffAccessProduct,
  laxStaffRoleOption,
} from "@auction/types";

/** A platform ticked before a role is chosen carries an empty role. */
export type DraftPlatformGrant = { product: LaxStaffAccessProduct; role: string };

/** What is wrong with the drafts, and where: no platform ticked, or a ticked one without a role. */
export type PlatformGrantsIssue = {
  message: string;
  target: "access" | "role";
  product: LaxStaffAccessProduct;
};

type Props = {
  /** Id of the group; each platform's checkbox and role field derive theirs from it. */
  id: string;
  value: DraftPlatformGrant[];
  onChange: (next: DraftPlatformGrant[]) => void;
  /** Shown under the role field of the platform it names. */
  roleError?: { product: LaxStaffAccessProduct; message: string } | null;
  disabled?: boolean;
};

export function platformCheckboxId(groupId: string, product: LaxStaffAccessProduct): string {
  return `${groupId}-${product}`;
}

export function platformRoleId(groupId: string, product: LaxStaffAccessProduct): string {
  return `${groupId}-${product}-role`;
}

/**
 * One row per LAX platform: tick the platform to give access, then pick that platform's role.
 * Sits inside a `Field`, which supplies the group's label, hint and error.
 */
export function InvitePlatformAccessPicker({
  id,
  value,
  onChange,
  roleError = null,
  disabled = false,
}: Props) {
  const field = useStaffField();

  function setGrant(product: LaxStaffAccessProduct, role: string | null) {
    const others = value.filter((g) => g.product !== product);
    const next = role === null ? others : [...others, { product, role }];
    onChange(LAX_STAFF_PLATFORMS.flatMap((p) => next.filter((g) => g.product === p.product)));
  }

  return (
    <fieldset
      id={id}
      tabIndex={-1}
      {...(field?.describedBy ? { "aria-describedby": field.describedBy } : {})}
      className="m-0 flex min-w-0 flex-col gap-1 border-0 p-0 outline-none"
    >
      <legend className="sr-only">Platform access</legend>
      {LAX_STAFF_PLATFORMS.map((platform) => {
        const grant = value.find((g) => g.product === platform.product);
        const checkboxId = platformCheckboxId(id, platform.product);
        const selected = grant?.role ? laxStaffRoleOption(platform.product, grant.role) : null;
        const error = roleError?.product === platform.product ? roleError.message : undefined;
        return (
          <div key={platform.product} className="flex flex-col">
            <ChoiceRow
              htmlFor={checkboxId}
              label={platform.label}
              description={platform.description}
              disabled={disabled}
              control={
                <StaffCheckbox
                  id={checkboxId}
                  checked={grant != null}
                  disabled={disabled}
                  onCheckedChange={(on) => setGrant(platform.product, on === true ? "" : null)}
                />
              }
            />
            {grant ? (
              <div className="pb-2 pl-6.5">
                <Field
                  label={`${platform.label} role`}
                  id={platformRoleId(id, platform.product)}
                  description={selected?.summary}
                  error={error}
                  disabled={disabled}
                >
                  <EnumSelect
                    value={grant.role === "" ? null : grant.role}
                    placeholder={`Choose a ${platform.label} role`}
                    options={platform.roles.map((role) => ({
                      value: role.value,
                      label: role.label,
                    }))}
                    onValueChange={(role) => setGrant(platform.product, role)}
                  />
                </Field>
              </div>
            ) : null}
          </div>
        );
      })}
    </fieldset>
  );
}

/** Checks the drafts before submit; names the first problem and the field it belongs to. */
export function platformGrantsIssue(
  drafts: readonly DraftPlatformGrant[],
): PlatformGrantsIssue | null {
  const first = LAX_STAFF_PLATFORMS[0];
  if (drafts.length === 0) {
    return {
      message: "Give access to at least one platform.",
      target: "access",
      product: first?.product ?? "bid",
    };
  }
  const missing = drafts.find((g) => g.role === "");
  if (!missing) return null;
  const label = LAX_STAFF_PLATFORMS.find((p) => p.product === missing.product)?.label;
  return {
    message: `Choose a ${label ?? missing.product} role.`,
    target: "role",
    product: missing.product,
  };
}
