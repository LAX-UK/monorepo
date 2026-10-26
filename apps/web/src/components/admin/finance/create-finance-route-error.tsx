"use client";

import { AdminErrorPage } from "@/components/admin/admin-error-page";
import { adminRouteErrorMessage } from "@/lib/admin/admin-route-error-message";
import { PageHeader } from "@auction/staff-ui";

type Config = {
  title: string;
  backHref: string;
  backLabel: string;
};

/** A finance page that failed to load: its title, what failed, Try again and a way back. */
export function createFinanceRouteError(config: Config) {
  return function FinanceRouteError({
    error,
    reset,
  }: {
    error: Error & { digest?: string };
    reset: () => void;
  }) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title={config.title} />
        <AdminErrorPage
          title={`${config.title} could not load`}
          message={adminRouteErrorMessage(error)}
          reset={reset}
          homeHref={config.backHref}
          homeLabel={config.backLabel}
          error={error}
        />
      </div>
    );
  };
}
