"use client";

import { adminRouteErrorMessage } from "@/lib/admin/admin-route-error-message";
import { useReportRouteError } from "@/lib/observability/use-report-route-error";
import { ErrorState, PageHeader, StaffButton } from "@auction/staff-ui";
import Link from "next/link";
import { useEffect } from "react";

type StaffPageErrorConfig = {
  /** The page that failed: "Saleroom". */
  title: string;
  backHref: string;
  /** Where Back goes: "Back to the saleroom". */
  backLabel: string;
};

/**
 * The error boundary for a whole staff page: the page's title stays, with what failed, Try again
 * and a way back. Used for tools that are neither a list nor a record.
 */
export function createStaffPageError(config: StaffPageErrorConfig) {
  return function StaffPageError({
    error,
    reset,
  }: {
    error: Error & { digest?: string };
    reset: () => void;
  }) {
    useReportRouteError(error);
    useEffect(() => {
      console.error(error);
    }, [error]);

    return (
      <div className="flex flex-col gap-6">
        <PageHeader title={config.title} />
        <div className="rounded-staff-lg border border-staff-line bg-staff-surface">
          <ErrorState
            title={`${config.title} did not load`}
            description={adminRouteErrorMessage(error)}
            action={
              <>
                <StaffButton variant="primary" onClick={reset}>
                  Try again
                </StaffButton>
                <StaffButton asChild variant="secondary">
                  <Link href={config.backHref}>{config.backLabel}</Link>
                </StaffButton>
              </>
            }
          />
        </div>
      </div>
    );
  };
}
