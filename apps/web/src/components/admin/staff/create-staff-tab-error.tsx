"use client";

import { adminRouteErrorMessage } from "@/lib/admin/admin-route-error-message";
import { DetailError } from "@auction/staff-ui";
import { useEffect } from "react";

/**
 * The error boundary for a record's routed tab: the failure shows in place of the tab's body,
 * under the record header and tabs, with Try again.
 */
export function createStaffTabError(config: { title: string }) {
  return function StaffTabError({
    error,
    reset,
  }: {
    error: Error & { digest?: string };
    reset: () => void;
  }) {
    useEffect(() => {
      console.error(error);
    }, [error]);
    return (
      <DetailError
        title={config.title}
        description={adminRouteErrorMessage(error)}
        onRetry={reset}
      />
    );
  };
}
