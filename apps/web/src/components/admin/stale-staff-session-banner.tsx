"use client";

import { useLogout } from "@/lib/auth/use-logout";
import { useStaleStaffSession } from "@/lib/auth/use-stale-staff-session";
import { Notice, StaffButton } from "@auction/staff-ui";
import { usePathname } from "next/navigation";

export function StaleStaffSessionBanner() {
  const stale = useStaleStaffSession();
  const pathname = usePathname();
  const next = encodeURIComponent(pathname || "/admin");
  const { logout, pending } = useLogout({ redirectTo: `/login?next=${next}` });

  if (!stale) return null;

  return (
    <Notice
      tone="warning"
      alert
      title="Staff permissions may be out of date"
      actions={
        <StaffButton size="sm" variant="secondary" loading={pending} onClick={() => void logout()}>
          Sign out and back in
        </StaffButton>
      }
    >
      Your session does not include a staff role. Sign out and sign back in after your account was
      granted catalogue access.
    </Notice>
  );
}
