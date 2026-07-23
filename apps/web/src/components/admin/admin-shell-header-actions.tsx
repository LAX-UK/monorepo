"use client";

import {
  type StaffAttentionItem,
  StaffNotificationBell,
} from "@/components/admin/staff-notification-bell";

type Props = {
  items: StaffAttentionItem[];
};

/** Global admin header: staff attention notifications. */
export function AdminShellHeaderActions({ items }: Props) {
  return (
    <div className="flex items-center gap-1 sm:gap-2">
      <StaffNotificationBell items={items} />
    </div>
  );
}
