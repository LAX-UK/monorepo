"use client";

import { AppRouteError } from "@/components/app/app-route-error";
import { AccountsUnavailable } from "@/components/layout/account-switcher/accounts-unavailable";
import { DASHBOARD_CTA, DASHBOARD_ROUTES } from "@/lib/dashboard/dashboard-copy";
import { isAccountsUnavailableError } from "@/lib/legal-entity/accounts-unavailable-error";
import { ROUTE_ERROR_PRESETS } from "@/lib/ui/empty-state-copy";

type DashboardRouteErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
  title?: string;
};

/**
 * Shared client error boundary for dashboard route segments. A page that could not read the
 * person's accounts gets the accounts retry state; the shell around it stays as it was.
 */
export default function DashboardRouteError({
  error,
  reset,
  title = ROUTE_ERROR_PRESETS.dashboard.title,
}: DashboardRouteErrorProps) {
  if (isAccountsUnavailableError(error)) {
    return <AccountsUnavailable retry={{ kind: "refresh", reset }} />;
  }
  return (
    <AppRouteError
      error={error}
      reset={reset}
      title={title}
      homeHref={DASHBOARD_ROUTES.home}
      homeLabel={DASHBOARD_CTA.openHome}
    />
  );
}
