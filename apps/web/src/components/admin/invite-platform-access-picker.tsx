"use client";

import {
  LAX_STAFF_PLATFORMS,
  type LaxStaffAccessProduct,
  laxStaffRoleOption,
} from "@auction/types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@auction/ui/components/select";
import { Switch } from "@auction/ui/components/switch";
import { useId } from "react";

/** A platform switched on before a role is chosen carries an empty role. */
export type DraftPlatformGrant = { product: LaxStaffAccessProduct; role: string };

type Props = {
  value: DraftPlatformGrant[];
  onChange: (next: DraftPlatformGrant[]) => void;
  disabled?: boolean;
};

/** One row per LAX platform: switch access on, then pick that platform's role. */
export function InvitePlatformAccessPicker({ value, onChange, disabled = false }: Props) {
  const baseId = useId();

  function setGrant(product: LaxStaffAccessProduct, role: string | null) {
    const others = value.filter((g) => g.product !== product);
    const next = role === null ? others : [...others, { product, role }];
    onChange(LAX_STAFF_PLATFORMS.flatMap((p) => next.filter((g) => g.product === p.product)));
  }

  return (
    <ul className="m-0 grid list-none gap-3 p-0">
      {LAX_STAFF_PLATFORMS.map((platform) => {
        const grant = value.find((g) => g.product === platform.product);
        const switchId = `${baseId}-${platform.product}`;
        const selected = grant?.role ? laxStaffRoleOption(platform.product, grant.role) : null;
        return (
          <li
            key={platform.product}
            className="rounded-lg border border-border-soft bg-surface-container-lowest p-3"
          >
            <div className="flex items-start justify-between gap-3">
              <label htmlFor={switchId} className="grid gap-0.5">
                <span className="font-body text-sm font-semibold text-on-surface">
                  {platform.label}
                </span>
                <span className="font-body text-xs text-on-surface-variant">
                  {platform.description}
                </span>
              </label>
              <Switch
                id={switchId}
                checked={grant != null}
                disabled={disabled}
                aria-label={`Give ${platform.label} access`}
                onCheckedChange={(on) => setGrant(platform.product, on ? "" : null)}
              />
            </div>
            {grant ? (
              <div className="mt-3 grid gap-1.5">
                <Select
                  disabled={disabled}
                  value={grant.role}
                  onValueChange={(role) => setGrant(platform.product, role)}
                >
                  <SelectTrigger
                    className="min-h-11 w-full font-body text-sm"
                    aria-label={`${platform.label} role`}
                  >
                    <SelectValue placeholder={`Choose a ${platform.label} role`} />
                  </SelectTrigger>
                  <SelectContent>
                    {platform.roles.map((role) => (
                      <SelectItem key={role.value} value={role.value}>
                        {role.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selected ? (
                  <p className="font-body text-xs text-on-surface-variant">{selected.summary}</p>
                ) : null}
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

/** Validates drafts before submit; returns a message for the first platform missing a role. */
export function platformGrantsError(drafts: readonly DraftPlatformGrant[]): string | null {
  if (drafts.length === 0) return "Give access to at least one platform";
  const missing = drafts.find((g) => g.role === "");
  if (!missing) return null;
  const label = LAX_STAFF_PLATFORMS.find((p) => p.product === missing.product)?.label;
  return `Choose a ${label ?? missing.product} role`;
}
