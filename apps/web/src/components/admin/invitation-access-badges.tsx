"use client";

import { StatusBadge } from "@auction/staff-ui";
import {
  LAX_STAFF_PLATFORMS,
  type LaxStaffGrant,
  type UserRole,
  type UserStaffRole,
  laxStaffRoleOption,
} from "@auction/types";

type Props = {
  targetRole: UserRole;
  targetStaffRole: UserStaffRole | null;
  grants: readonly LaxStaffGrant[];
};

/** "Client" for a client invitation; for staff, one "Platform · Roles" badge per platform. */
export function InvitationAccessBadges({ targetRole, targetStaffRole, grants }: Props) {
  if (targetRole !== "staff") return <StatusBadge tone="neutral">Client</StatusBadge>;

  const labels = LAX_STAFF_PLATFORMS.flatMap((platform) => {
    const granted = grants.filter((g) => g.product === platform.product).map((g) => g.role);
    const roles =
      granted.length > 0
        ? granted
        : platform.product === "bid" && targetStaffRole
          ? [targetStaffRole]
          : [];
    if (roles.length === 0) return [];
    const names = roles.map((role) => laxStaffRoleOption(platform.product, role)?.label ?? role);
    return [`${platform.label} · ${names.join(", ")}`];
  });

  if (labels.length === 0) return <StatusBadge tone="neutral">Staff</StatusBadge>;
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      {labels.map((label) => (
        <StatusBadge key={label} tone="neutral">
          {label}
        </StatusBadge>
      ))}
    </span>
  );
}
