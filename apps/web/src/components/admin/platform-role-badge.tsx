"use client";

import {
  type PlatformRolePaletteKey,
  resolvePlatformRolePresentation,
} from "@/lib/presenters/platform-role/platform-role-registry";
import type { UserRole, UserStaffRole } from "@auction/types";
import { cn } from "@auction/ui";

type Props = {
  targetRole: UserRole;
  targetStaffRole?: UserStaffRole | null;
  className?: string;
  /** When set, overrides resolved palette (tests/storybook). */
  paletteKey?: PlatformRolePaletteKey;
  /** When set, overrides resolved label. */
  label?: string;
};

const BADGE_BASE =
  "inline-flex w-fit max-w-full shrink-0 items-center whitespace-nowrap rounded-full px-2.5 py-0.5 font-label text-xs font-semibold leading-[18px]";

/** Tag-style role pill with unique categorical color per platform role. */
export function PlatformRoleBadge({
  targetRole,
  targetStaffRole = null,
  className,
  paletteKey: paletteKeyOverride,
  label: labelOverride,
}: Props) {
  const presentation = resolvePlatformRolePresentation(targetRole, targetStaffRole ?? null);
  const paletteKey = paletteKeyOverride ?? presentation.paletteKey;
  const visibleLabel = labelOverride ?? presentation.label;

  return (
    <span
      className={cn(BADGE_BASE, "platform-role-badge", className)}
      data-platform-role={paletteKey}
      aria-label={presentation.ariaLabel}
      title={presentation.ariaLabel}
    >
      {visibleLabel}
    </span>
  );
}
