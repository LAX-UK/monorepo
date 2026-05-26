"use client";

import { AppRouteError } from "@/components/app/app-route-error";
import { DASHBOARD_CTA, DASHBOARD_ROUTES } from "@/lib/dashboard/dashboard-copy";
import { ROUTE_ERROR_PRESETS } from "@/lib/ui/empty-state-copy";

type DashboardRouteErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
  title?: string;
};

/** Shared client error boundary for dashboard route segments. */
export default function DashboardRouteError({
  error,
  reset,
  title = ROUTE_ERROR_PRESETS.dashboard.title,
}: DashboardRouteErrorProps) {
  return (
    <AppRouteError
      error={error}
      reset={reset}
      title={title}
      homeHref={DASHBOARD_ROUTES.overview}
      homeLabel={DASHBOARD_CTA.openOverview}
    />
  );
}
