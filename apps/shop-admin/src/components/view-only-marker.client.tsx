"use client";

import {
  type StaffPermission,
  ViewOnlyBadge,
  useStaffAccess,
  useStaffCan,
} from "@auction/staff-ui";

/**
 * The "View only" marker for a page header, shown when the person lacks the permission
 * that changes what the page shows. For server pages whose body is not a kit page template.
 */
export function ViewOnlyMarker({ editRequires }: { editRequires: StaffPermission }) {
  const { roleLabel } = useStaffAccess();
  if (useStaffCan(editRequires)) return null;
  return <ViewOnlyBadge {...(roleLabel ? { role: roleLabel } : {})} />;
}
