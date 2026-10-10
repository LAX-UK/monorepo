"use client";

import { PlatformRoleBadge } from "@/components/admin/platform-role-badge";
import {
  type LaxStaffGrant,
  type UserRole,
  type UserStaffRole,
  laxStaffPlatform,
  laxStaffRoleOption,
} from "@auction/types";

type Props = {
  targetRole: UserRole;
  targetStaffRole: UserStaffRole | null;
  grants: readonly LaxStaffGrant[];
};

/** Bid keeps its per-role palette; other platforms read "Platform · Role". */
export function InvitationAccessBadges({ targetRole, targetStaffRole, grants }: Props) {
  const others = grants.filter((g) => g.product !== "bid");
  const hasBid = grants.some((g) => g.product === "bid") || targetRole === "staff";
  if (others.length === 0) {
    return <PlatformRoleBadge targetRole={targetRole} targetStaffRole={targetStaffRole} />;
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      {hasBid ? <PlatformRoleBadge targetRole="staff" targetStaffRole={targetStaffRole} /> : null}
      {others.map((g) => {
        const label = `${laxStaffPlatform(g.product).label} · ${laxStaffRoleOption(g.product, g.role)?.label ?? g.role}`;
        return (
          <span
            key={g.product}
            className="inline-flex w-fit shrink-0 items-center whitespace-nowrap rounded-full border border-border-soft px-2.5 py-0.5 font-label text-xs font-semibold leading-[18px] text-on-surface"
            title={label}
          >
            {label}
          </span>
        );
      })}
    </span>
  );
}
