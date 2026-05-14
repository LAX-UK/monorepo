"use client";

import { DashboardErrorAlert } from "@/components/dashboard/primitives/dashboard-error-alert";
import { Button } from "@/components/ui/button";
import * as Sentry from "@sentry/nextjs";
import Link from "next/link";
import { useEffect } from "react";

export default function SellerDashboardError({
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
      : "Something interrupted the seller workspace. Try again or return to the overview.";

  return (
    <section className="mx-auto flex w-full max-w-xl flex-col justify-center px-6 py-24">
      <DashboardErrorAlert title="Seller workspace error" message={message}>
        <div className="mt-4 flex flex-wrap gap-3">
          <Button type="button" variant="primary" onClick={() => reset()}>
            Try again
          </Button>
          <Link
            href="/dashboard/seller"
            className="inline-flex items-center justify-center rounded-md border border-outline-variant/30 bg-transparent px-10 py-4 font-label text-xs font-semibold uppercase tracking-[0.3em] text-on-surface transition-colors hover:bg-surface-container-low"
          >
            Seller home
          </Link>
        </div>
      </DashboardErrorAlert>
    </section>
  );
}
