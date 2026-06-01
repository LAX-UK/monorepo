"use client";

import { AdminDetailSkeleton } from "@/components/admin/admin-detail-skeleton";
import { adminRouteErrorMessage } from "@/lib/admin/admin-route-error-message";
import { Button } from "@auction/ui/components/button";
import Link from "next/link";
import { useEffect } from "react";

type AdminDetailRouteErrorConfig = {
  title: string;
  backHref: string;
  backLabel: string;
};

/** Factory for admin user/entity detail route error boundaries. */
export function createAdminDetailRouteError(config: AdminDetailRouteErrorConfig) {
  return function AdminDetailRouteError({
    error,
    reset,
  }: {
    error: Error & { digest?: string };
    reset: () => void;
  }) {
    useEffect(() => {
      console.error(error);
    }, [error]);

    return (
      <div className="space-y-6">
        <AdminDetailSkeleton />
        <div className="rounded-lg border border-border-hairline bg-surface-container-low/30 p-6">
          <h2 className="font-headline text-lg text-on-surface">
            Could not load {config.title.toLowerCase()}
          </h2>
          <p className="mt-2 font-body text-sm text-on-surface-variant">
            {adminRouteErrorMessage(error)}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button type="button" variant="default" onClick={reset}>
              Try again
            </Button>
            <Button variant="secondary" asChild>
              <Link href={config.backHref}>{config.backLabel}</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  };
}
