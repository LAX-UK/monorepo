"use client";

import { ChoiceRow, EnumSelect, Field, StaffCheckbox, useStaffField } from "@auction/staff-ui";
import {
  LAX_STAFF_PLATFORMS,
  type LaxStaffAccessProduct,
  type LaxStaffGrant,
  type LaxStaffPlatform,
  checkStaffRoleSet,
  laxStaffRoleOption,
  normalizeStaffRoles,
  staffRoleRefusalMessage,
} from "@auction/types";

/** A ticked platform and the roles chosen on it so far (none until the person picks one). */
export type DraftPlatformAccess = { product: LaxStaffAccessProduct; roles: string[] };

/** What is wrong with the drafts, and where: no platform ticked, or a ticked one's roles. */
export type PlatformGrantsIssue = {
  message: string;
  target: "access" | "role";
  product: LaxStaffAccessProduct;
};

type Props = {
  /** Id of the group; each platform's checkbox and role field derive theirs from it. */
  id: string;
  value: DraftPlatformAccess[];
  onChange: (next: DraftPlatformAccess[]) => void;
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

/** The grants the drafts stand for, one per chosen role. */
export function draftGrants(drafts: readonly DraftPlatformAccess[]): LaxStaffGrant[] {
  return drafts.flatMap((draft) => draft.roles.map((role) => ({ product: draft.product, role })));
}

/**
 * Bid roles one person may not hold together, as soon as they are chosen: the same rule the API
 * applies when the invitation is sent and again when it is accepted.
 */
export function platformRoleCombinationIssue(
  drafts: readonly DraftPlatformAccess[],
): PlatformGrantsIssue | null {
  const bid = drafts.find((draft) => draft.product === "bid");
  if (!bid) return null;
  const together = checkStaffRoleSet(normalizeStaffRoles(bid.roles));
  if (together.ok) return null;
  return { message: staffRoleRefusalMessage(together), target: "role", product: "bid" };
}

/** Checks the drafts before submit; names the first problem and the field it belongs to. */
export function platformGrantsIssue(
  drafts: readonly DraftPlatformAccess[],
): PlatformGrantsIssue | null {
  const first = LAX_STAFF_PLATFORMS[0];
  if (drafts.length === 0) {
    return {
      message: "Give access to at least one platform.",
      target: "access",
      product: first?.product ?? "bid",
    };
  }
  const missing = drafts.find((draft) => draft.roles.length === 0);
  if (missing) {
    const platform = LAX_STAFF_PLATFORMS.find((p) => p.product === missing.product);
    const label = platform?.label ?? missing.product;
    return {
      message: platform?.multipleRoles
        ? `Choose at least one ${label} role.`
        : `Choose a ${label} role.`,
      target: "role",
      product: missing.product,
    };
  }
  return platformRoleCombinationIssue(drafts);
}

/** Several roles: one checkbox per role with what it does. Sits inside a `Field`. */
function RoleChecklist({
  id,
  platform,
  roles,
  onChange,
  disabled,
}: {
  id: string;
  platform: LaxStaffPlatform;
  roles: readonly string[];
  onChange: (roles: string[]) => void;
  disabled: boolean;
}) {
  const field = useStaffField();
  const toggle = (role: string, on: boolean) => {
    const next = on ? [...roles, role] : roles.filter((held) => held !== role);
    onChange(platform.roles.map((option) => option.value).filter((value) => next.includes(value)));
  };
  return (
    <fieldset
      id={id}
      tabIndex={-1}
      {...(field ? { "aria-labelledby": field.labelId } : {})}
      {...(field?.describedBy ? { "aria-describedby": field.describedBy } : {})}
      {...(field?.invalid ? { "aria-invalid": true } : {})}
      className="m-0 flex min-w-0 flex-col border-0 p-0 outline-none"
    >
      {platform.roles.map((option) => {
        const optionId = `${id}-${option.value}`;
        return (
          <ChoiceRow
            key={option.value}
            htmlFor={optionId}
            label={option.label}
            description={option.summary}
            disabled={disabled}
            control={
              <StaffCheckbox
                id={optionId}
                checked={roles.includes(option.value)}
                disabled={disabled}
                onCheckedChange={(on) => toggle(option.value, on === true)}
              />
            }
          />
        );
      })}
    </fieldset>
  );
}

/**
 * One row per LAX platform: tick the platform to give access, then choose its roles: several on
 * Bid, where permissions add up, one on Shop. Sits inside a `Field`, which supplies the group's
 * label, hint and error. A Bid combination one person may not hold is explained as soon as it is
 * chosen.
 */
export function InvitePlatformAccessPicker({
  id,
  value,
  onChange,
  roleError = null,
  disabled = false,
}: Props) {
  const field = useStaffField();
  const combination = platformRoleCombinationIssue(value);

  function setRoles(product: LaxStaffAccessProduct, roles: string[] | null) {
    const others = value.filter((draft) => draft.product !== product);
    const next = roles === null ? others : [...others, { product, roles }];
    onChange(
      LAX_STAFF_PLATFORMS.flatMap((p) => next.filter((draft) => draft.product === p.product)),
    );
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
        const draft = value.find((d) => d.product === platform.product);
        const checkboxId = platformCheckboxId(id, platform.product);
        const roleId = platformRoleId(id, platform.product);
        const error =
          roleError?.product === platform.product
            ? roleError.message
            : combination?.product === platform.product
              ? combination.message
              : undefined;
        const chosen = draft?.roles[0]
          ? laxStaffRoleOption(platform.product, draft.roles[0])
          : null;
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
                  checked={draft != null}
                  disabled={disabled}
                  onCheckedChange={(on) => setRoles(platform.product, on === true ? [] : null)}
                />
              }
            />
            {draft ? (
              <div className="pb-2 pl-6.5">
                {platform.multipleRoles ? (
                  <Field
                    label={`${platform.label} roles`}
                    id={roleId}
                    description="Choose one or more. Their permissions add up."
                    error={error}
                    disabled={disabled}
                  >
                    <RoleChecklist
                      id={roleId}
                      platform={platform}
                      roles={draft.roles}
                      onChange={(roles) => setRoles(platform.product, roles)}
                      disabled={disabled}
                    />
                  </Field>
                ) : (
                  <Field
                    label={`${platform.label} role`}
                    id={roleId}
                    description={chosen?.summary}
                    error={error}
                    disabled={disabled}
                  >
                    <EnumSelect
                      value={draft.roles[0] ?? null}
                      placeholder={`Choose a ${platform.label} role`}
                      options={platform.roles.map((role) => ({
                        value: role.value,
                        label: role.label,
                      }))}
                      onValueChange={(role) => setRoles(platform.product, [role])}
                    />
                  </Field>
                )}
              </div>
            ) : null}
          </div>
        );
      })}
    </fieldset>
  );
}
