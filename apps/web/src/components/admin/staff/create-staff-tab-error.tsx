"use client";

import { adminRouteErrorMessage } from "@/lib/admin/admin-route-error-message";
import { DetailError } from "@auction/staff-ui";

/**
 * The error boundary for a record's routed tab: the failure shows in place of the tab's body,
 * under the record header and tabs, with Try again.
 *
 * Try again reloads the page. `reset()` alone re-renders the tab from the server payload it
 * already holds, so a live tab (door check-in) would come back showing the state it was loaded
 * with; and when the error is a server action the server no longer has after a deploy, nothing
 * short of a fresh page from the current build can help. A reload covers both. (Next.js logs the
 * error to the console itself.)
 */
export function createStaffTabError(config: { title: string }) {
  return function StaffTabError({
    error,
  }: { error: Error & { digest?: string }; reset: () => void }) {
    return (
      <DetailError
        title={config.title}
        description={adminRouteErrorMessage(error)}
        onRetry={() => window.location.reload()}
      />
    );
  };
}
