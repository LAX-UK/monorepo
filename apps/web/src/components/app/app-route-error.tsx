"use client";

import {
  EmptyStateIllustration,
  type EmptyStateIllustrationKey,
} from "@/components/illustrations/empty-state-illustrations";
import { DisplayHeading } from "@/components/ui/typography";
import { isSessionLookupTransientError } from "@/lib/auth/session-lookup-error";
import { useReportRouteError } from "@/lib/observability/use-report-route-error";
import { cn } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import Link from "next/link";

export type AppRouteErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
  title?: string;
  homeHref?: string;
  homeLabel?: string;
  illustration?: EmptyStateIllustrationKey;
  /** When true, pad below the fixed marketing site header. */
  siteHeaderOffset?: boolean;
};

/** Shared client error boundary UI with Sentry reporting. */
export function AppRouteError({
  error,
  reset,
  title = "Something went wrong",
  homeHref = "/",
  homeLabel = "Back to gallery",
  illustration = "error",
  siteHeaderOffset = false,
}: AppRouteErrorProps) {
  useReportRouteError(error);

  const sessionUnavailable = isSessionLookupTransientError(error);
  const resolvedTitle = sessionUnavailable ? "We couldn’t confirm your session" : title;
  const fallbackDetail =
    process.env.NODE_ENV === "development" ? error.message : "Please try again in a moment.";
  const message = sessionUnavailable
    ? "Your sign-in is still saved. Try again in a moment."
    : fallbackDetail;

  return (
    <section
      className={cn(
        "mx-auto flex w-full max-w-xl flex-col items-center justify-center px-6 py-24 text-center",
        siteHeaderOffset && "min-h-[calc(100dvh-var(--header-height))] pt-[var(--header-height)]",
      )}
      role="alert"
    >
      <EmptyStateIllustration name={illustration} className="mb-6 h-20 w-32" />
      <DisplayHeading as="h1" className="mb-4 text-3xl">
        {resolvedTitle}
      </DisplayHeading>
      <p className="mb-8 font-body text-sm text-on-surface-variant">{message}</p>
      <div className="flex flex-wrap justify-center gap-3">
        <Button type="button" variant="primary" onClick={() => reset()}>
          Try again
        </Button>
        <Link
          href={homeHref}
          className="inline-flex items-center justify-center rounded-md border border-outline-variant/30 bg-transparent px-10 py-4 font-label text-xs font-semibold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-surface transition-colors hover:bg-surface-container-low"
        >
          {homeLabel}
        </Link>
      </div>
    </section>
  );
}
