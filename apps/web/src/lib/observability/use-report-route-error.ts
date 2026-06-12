"use client";

import { readNextErrorDigest } from "@auction/observability/next-error-digest";
import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

/** Report a Next.js route error boundary failure to the console and Sentry. */
export function useReportRouteError(error: (Error & { digest?: string }) | undefined): void {
  useEffect(() => {
    if (!error) return;
    console.error(error);
    Sentry.withScope((scope) => {
      const digest = readNextErrorDigest(error);
      if (digest) {
        scope.setTag("next.digest", digest);
        scope.setTag("next.error_source", "client");
      }
      Sentry.captureException(error);
    });
  }, [error]);
}
