"use client";

import {
  EmptyStateIllustration,
  type EmptyStateIllustrationKey,
} from "@/components/illustrations/empty-state-illustrations";
import { useReportRouteError } from "@/lib/observability/use-report-route-error";
import { Button } from "@auction/ui/components/button";
import Link from "next/link";

type Props = {
  title?: string;
  message?: string;
  reset?: () => void;
  homeHref?: string;
  homeLabel?: string;
  illustration?: EmptyStateIllustrationKey;
  error?: Error & { digest?: string };
};

/** Shared admin route error boundary UI. */
export function AdminErrorPage({
  title = "Admin hiccup",
  message = "Something went wrong loading this page. Try again or return to the dashboard.",
  reset,
  homeHref = "/admin",
  homeLabel = "Back to admin home",
  illustration = "error",
  error,
}: Props) {
  useReportRouteError(error);

  return (
    <div
      className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-4 text-center"
      role="alert"
    >
      <EmptyStateIllustration name={illustration} className="h-20 w-32" />
      <h1 className="font-display text-2xl text-on-surface">{title}</h1>
      <p className="max-w-md font-body text-sm text-on-surface-variant">{message}</p>
      <div className="flex flex-wrap justify-center gap-2">
        {reset ? (
          <Button type="button" variant="default" onClick={reset}>
            Try again
          </Button>
        ) : null}
        <Button variant="outline" asChild>
          <Link href={homeHref}>{homeLabel}</Link>
        </Button>
      </div>
    </div>
  );
}
