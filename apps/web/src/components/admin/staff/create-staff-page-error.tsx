"use client";

import { adminRouteErrorMessage } from "@/lib/admin/admin-route-error-message";
import { isStaleServerActionError } from "@/lib/next/stale-server-action";
import { useReportRouteError } from "@/lib/observability/use-report-route-error";
import { ErrorState, PageHeader, StaffButton } from "@auction/staff-ui";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type TransitionStartFunction, useEffect, useTransition } from "react";

type StaffPageErrorConfig = {
  /** The page that failed: "Saleroom". */
  title: string;
  backHref: string;
  /** Where Back goes: "Back to the saleroom". */
  backLabel: string;
};

export type StaffPageRetryDeps = {
  error: Error;
  reset: () => void;
  refresh: () => void;
  reload: () => void;
  startTransition: TransitionStartFunction;
};

/**
 * What Try again does. `reset()` alone re-renders the page from the server payload it already
 * holds, so a live page (the clerk console) would come back showing the prices and lot state from
 * when it was first loaded. Instead the page is fetched again (`router.refresh()`) and the
 * boundary resets in the same transition, so the error stays on screen until the fresh state is
 * there to replace it. When the error says the page was built before a deploy (a server action
 * the server no longer has), refetching cannot help, so the page reloads onto the current build.
 */
export function retryStaffPage({
  error,
  reset,
  refresh,
  reload,
  startTransition,
}: StaffPageRetryDeps): void {
  if (isStaleServerActionError(error)) {
    reload();
    return;
  }
  startTransition(() => {
    refresh();
    reset();
  });
}

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
    const router = useRouter();
    const [retrying, startTransition] = useTransition();
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
                <StaffButton
                  variant="primary"
                  loading={retrying}
                  onClick={() =>
                    retryStaffPage({
                      error,
                      reset,
                      refresh: () => router.refresh(),
                      reload: () => window.location.reload(),
                      startTransition,
                    })
                  }
                >
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
