"use client";

import { useReportRouteError } from "@/lib/observability/use-report-route-error";
import { AccountLoadError } from "./account-load-error";

type AccountRouteErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
  title: string;
  description: string;
};

/** A personal account page that failed to render: reported, then the shared load error. */
export function AccountRouteError({ error, reset, title, description }: AccountRouteErrorProps) {
  useReportRouteError(error);
  return <AccountLoadError title={title} description={description} onRetry={reset} />;
}
