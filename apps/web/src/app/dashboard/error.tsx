"use client";

import { DashboardErrorAlert } from "@/components/dashboard/primitives/dashboard-error-alert";
import { Button } from "@/components/ui/button";
import * as Sentry from "@sentry/nextjs";
import Link from "next/link";
import { useEffect } from "react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
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
      <DashboardErrorAlert title="Dashboard hiccup" message={message}>
        <div className="mt-4 flex flex-wrap gap-3">
          <Button type="button" variant="primary" onClick={() => reset()}>
            Try again
          </Button>
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center rounded-md border border-outline-variant/30 bg-transparent px-10 py-4 font-label text-xs font-semibold uppercase tracking-[0.3em] text-on-surface transition-colors hover:bg-surface-container-low"
          >
            Open overview
          </Link>
        </div>
      </DashboardErrorAlert>
    </section>
  );
}
