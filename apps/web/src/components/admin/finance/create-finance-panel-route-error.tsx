"use client";

import { AdminPanelPage } from "@/components/admin/admin-panel-page";
import { adminRouteErrorMessage } from "@/lib/admin/admin-route-error-message";
import { Button } from "@auction/ui/components/button";
import Link from "next/link";
import { useEffect } from "react";

type FinancePanelRouteErrorConfig = {
  title: string;
  backHref: string;
  backLabel: string;
};

/** Factory for finance-module panel route error boundaries (settlement, integrations). */
export function createFinancePanelRouteError(config: FinancePanelRouteErrorConfig) {
  return function FinancePanelRouteError({
    error,
    reset,
  }: {
    error: Error & { digest?: string };
    reset: () => void;
  }) {
    useEffect(() => {
      console.error(error);
    }, [error]);

    const message = adminRouteErrorMessage(error);

    return (
      <AdminPanelPage title={config.title} description="Error">
        <div className="flex flex-col items-start gap-4 rounded-lg border border-border-hairline bg-surface-container-low/30 p-6">
          <h2 className="font-headline text-lg text-on-surface">
            Could not load {config.title.toLowerCase()}
          </h2>
          <p className="font-body text-sm text-on-surface-variant">{message}</p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="default" onClick={reset}>
              Try again
            </Button>
            <Button variant="secondary" asChild>
              <Link href={config.backHref}>{config.backLabel}</Link>
            </Button>
          </div>
        </div>
      </AdminPanelPage>
    );
  };
}
