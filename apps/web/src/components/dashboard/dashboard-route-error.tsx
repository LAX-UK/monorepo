"use client";

import { AppRouteError } from "@/components/app/app-route-error";
import { AccountsUnavailable } from "@/components/layout/account-switcher/accounts-unavailable";
import { useAccountHomeLink } from "@/components/layout/account-switcher/use-account-home-link";
import { isAccountsUnavailableError } from "@/lib/legal-entity/accounts-unavailable-error";
import { ROUTE_ERROR_PRESETS } from "@/lib/ui/empty-state-copy";

type DashboardRouteErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
  title?: string;
};

/**
 * Shared client error boundary for dashboard route segments, with the way back to the first page
 * of the account in use (Home inside an organisation). A page that could not read the
 * person's accounts gets the accounts retry state; the shell around it stays as it was.
 */
export default function DashboardRouteError({
  error,
  reset,
  title = ROUTE_ERROR_PRESETS.dashboard.title,
}: DashboardRouteErrorProps) {
  const home = useAccountHomeLink();
  if (isAccountsUnavailableError(error)) {
    return <AccountsUnavailable retry={{ kind: "refresh", reset }} />;
  }
  return (
    <AppRouteError
      error={error}
      reset={reset}
      title={title}
      homeHref={home.href}
      homeLabel={home.label}
    />
  );
}
