"use client";

import { DashboardErrorAlert } from "@/components/dashboard/primitives/dashboard-error-alert";
import { Button } from "@/components/ui/button";
import { DASHBOARD_CTA, DASHBOARD_ROUTES } from "@/lib/dashboard/dashboard-copy";
import * as Sentry from "@sentry/nextjs";
import Link from "next/link";
import { useEffect } from "react";

type DashboardRouteErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
  title?: string;
};

/** Shared client error boundary for dashboard route segments. */
export default function DashboardRouteError({
  error,
  reset,
  title = "Something went wrong",
}: DashboardRouteErrorProps) {
  useEffect(() => {
    console.error(error);
    Sentry.captureException(error);
  }, [error]);

  const message =
    process.env.NODE_ENV === "development"
      ? error.message
      : "Something interrupted this view. Try again or head back to the overview.";

  return (
    <section className="mx-auto flex w-full max-w-xl flex-col justify-center px-6 py-24">
      <DashboardErrorAlert title={title} message={message}>
        <div className="mt-4 flex flex-wrap gap-3">
          <Button type="button" variant="primary" onClick={() => reset()}>
            {DASHBOARD_CTA.tryAgain}
          </Button>
          <Link
            href={DASHBOARD_ROUTES.overview}
            className="inline-flex items-center justify-center rounded-md border border-outline-variant/30 bg-transparent px-10 py-4 font-label text-xs font-semibold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-surface transition-colors hover:bg-surface-container-low"
          >
            {DASHBOARD_CTA.openOverview}
          </Link>
        </div>
      </DashboardErrorAlert>
    </section>
  );
}
