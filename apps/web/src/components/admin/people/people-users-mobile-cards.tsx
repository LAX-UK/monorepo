"use client";

import {
  AdminUserListBulkBar,
  useAdminUserPreviewActions,
  useAdminUserPreviewBulk,
} from "@/components/admin/admin-user-preview-provider";
import {
  PeopleClientMobileCard,
  PeopleStaffMobileCard,
} from "@/components/admin/people/people-mobile-card";
import { formatAdminUserDate } from "@/lib/admin/format-admin-user-date";
import { formatSignupPersona } from "@/lib/admin/format-signup-persona";
import { staffRoleLabel } from "@/lib/admin/staff-role-presenter";
import type { AdminUserRow } from "@/lib/data/http/admin.server";
import type { UserStaffRole } from "@auction/types";
import { Checkbox } from "@auction/ui/components/checkbox";
import type { ReactNode } from "react";

type Props = {
  rows: AdminUserRow[];
};

function useOpenUserPreview() {
  const actions = useAdminUserPreviewActions();
  return (userId: string) => actions?.openUser(userId);
}

function UserMobileCardRow({
  userId,
  children,
}: {
  userId: string;
  children: ReactNode;
}) {
  const bulk = useAdminUserPreviewBulk();
  const selected = bulk?.isSelected(userId) ?? false;

  if (!bulk) {
    return <>{children}</>;
  }

  return (
    <div className="flex items-start gap-3">
      <Checkbox
        checked={selected}
        onCheckedChange={(checked) => bulk.toggleSelected(userId, checked === true)}
        aria-label="Select row"
        className="mt-4"
      />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

export function PeopleClientsMobileCards({ rows }: Props) {
  const openUser = useOpenUserPreview();

  return (
    <ul className="space-y-2">
      {rows.map((user) => (
        <li key={user.id}>
          <UserMobileCardRow userId={user.id}>
            <PeopleClientMobileCard
              user={user}
              onOpen={() => openUser?.(user.id)}
              formatPersona={formatSignupPersona}
              formatJoined={formatAdminUserDate}
            />
          </UserMobileCardRow>
        </li>
      ))}
    </ul>
  );
}

export function PeopleStaffMobileCards({ rows }: Props) {
  const openUser = useOpenUserPreview();

  return (
    <ul className="space-y-2">
      {rows.map((user) => (
        <li key={user.id}>
          <UserMobileCardRow userId={user.id}>
            <PeopleStaffMobileCard
              user={user}
              onOpen={() => openUser?.(user.id)}
              roleLabel={staffRoleLabel(user.staffRole as UserStaffRole | null)}
            />
          </UserMobileCardRow>
        </li>
      ))}
    </ul>
  );
}

export { AdminUserListBulkBar };
