"use client";

import { useAdminBulkSelectionBulk } from "@/components/admin/admin-bulk-selection-bridge";
import {
  PeopleClientMobileCard,
  PeopleStaffMobileCard,
} from "@/components/admin/people/people-mobile-card";
import { formatAdminUserDate } from "@/lib/admin/format-admin-user-date";
import { buildClientsDrawerHref } from "@/lib/admin/people/clients-list-href";
import { buildStaffDrawerHref } from "@/lib/admin/people/staff-list-href";
import { staffRoleLabel } from "@/lib/admin/staff-role-presenter";
import type { AdminUserRow } from "@/lib/data/http/admin.server";
import type { UserStaffRole } from "@auction/types";
import { Checkbox } from "@auction/ui/components/checkbox";
import { useRouter, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";

type Props = {
  rows: AdminUserRow[];
};

function UserMobileCardRow({
  userId,
  children,
}: {
  userId: string;
  children: ReactNode;
}) {
  const bulk = useAdminBulkSelectionBulk();
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
  const router = useRouter();
  const searchParams = useSearchParams();

  return (
    <ul className="space-y-2">
      {rows.map((user) => (
        <li key={user.id}>
          <UserMobileCardRow userId={user.id}>
            <PeopleClientMobileCard
              user={user}
              onOpen={() =>
                router.push(buildClientsDrawerHref(searchParams, user.id), { scroll: false })
              }
              formatJoined={formatAdminUserDate}
            />
          </UserMobileCardRow>
        </li>
      ))}
    </ul>
  );
}

export function PeopleStaffMobileCards({ rows }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  return (
    <ul className="space-y-2">
      {rows.map((user) => (
        <li key={user.id}>
          <UserMobileCardRow userId={user.id}>
            <PeopleStaffMobileCard
              user={user}
              onOpen={() =>
                router.push(buildStaffDrawerHref(searchParams, user.id), { scroll: false })
              }
              roleLabel={staffRoleLabel(user.staffRole as UserStaffRole | null)}
            />
          </UserMobileCardRow>
        </li>
      ))}
    </ul>
  );
}

export { AdminBulkSelectionBar as AdminUserListBulkBar } from "@/components/admin/admin-bulk-selection-bridge";
