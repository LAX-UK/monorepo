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

/** "Client" for a client invitation; one "Platform · Role" badge per platform for staff. */
export function InvitationAccessBadges({ targetRole, targetStaffRole, grants }: Props) {
  if (targetRole !== "staff") return <StatusBadge tone="neutral">Client</StatusBadge>;

  const labels = LAX_STAFF_PLATFORMS.flatMap((platform) => {
    const role =
      grants.find((g) => g.product === platform.product)?.role ??
      (platform.product === "bid" ? targetStaffRole : null);
    if (!role) return [];
    return [`${platform.label} · ${laxStaffRoleOption(platform.product, role)?.label ?? role}`];
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
