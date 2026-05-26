"use client";

import { GlobalErrorShell } from "@/components/app/global-error-shell";
import { useReportRouteError } from "@/lib/observability/use-report-route-error";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useReportRouteError(error);
  return <GlobalErrorShell error={error} reset={reset} />;
}
