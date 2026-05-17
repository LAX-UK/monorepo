"use client";

import { authClient } from "@/lib/auth-client";
import { useStaleStaffSession } from "@/lib/auth/use-stale-staff-session";
import { Button } from "@auction/ui/components/button";
import { usePathname } from "next/navigation";

export function StaleStaffSessionBanner() {
  const stale = useStaleStaffSession();
  const pathname = usePathname();

  if (!stale) return null;

  return (
    <div
      role="alert"
      className="mb-6 rounded-md border border-warning/40 bg-warning/10 px-4 py-3 font-body text-sm text-on-surface"
    >
      <p className="font-medium text-warning">Staff permissions may be out of date</p>
      <p className="mt-1 text-on-surface-variant">
        Your session does not include a staff role. Sign out and sign back in after your account was
        granted catalogue access.
      </p>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="mt-3"
        onClick={() => {
          void authClient.signOut().then(() => {
            const next = encodeURIComponent(pathname || "/admin");
            window.location.href = `/login?next=${next}`;
          });
        }}
      >
        Sign out and back in
      </Button>
    </div>
  );
}
