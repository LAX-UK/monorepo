"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

/** Report a Next.js route error boundary failure to the console and Sentry. */
export function useReportRouteError(error: (Error & { digest?: string }) | undefined): void {
  useEffect(() => {
    if (!error) return;
    console.error(error);
    Sentry.captureException(error);
  }, [error]);
}
