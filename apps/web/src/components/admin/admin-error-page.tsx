"use client";

import { useReportRouteError } from "@/lib/observability/use-report-route-error";
import { ErrorState, StaffButton } from "@auction/staff-ui";
import Link from "next/link";

type Props = {
  title?: string;
  message?: string;
  reset?: () => void;
  homeHref?: string;
  homeLabel?: string;
  error?: Error & { digest?: string };
};

/** A staff route that failed to load: what failed, Try again, and a way back. */
export function AdminErrorPage({
  title = "This page could not load",
  message = "Something went wrong loading this page. Try again, or go back to Overview.",
  reset,
  homeHref = "/admin",
  homeLabel = "Back to Overview",
  error,
}: Props) {
  useReportRouteError(error);

  return (
    <ErrorState
      title={title}
      description={message}
      headingLevel="h2"
      action={
        <>
          <StaffButton asChild>
            <Link href={homeHref}>{homeLabel}</Link>
          </StaffButton>
          {reset ? (
            <StaffButton variant="primary" onClick={reset}>
              Try again
            </StaffButton>
          ) : null}
        </>
      }
    />
  );
}
