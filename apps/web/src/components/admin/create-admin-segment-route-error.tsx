"use client";

import { AdminErrorPage } from "@/components/admin/admin-error-page";
import { adminRouteErrorMessage } from "@/lib/admin/admin-route-error-message";
import { useEffect } from "react";

type AdminSegmentRouteErrorConfig = {
  title?: string;
  homeHref?: string;
  homeLabel?: string;
};

/** Factory for admin segment error boundaries (platform hub, saleroom, impersonation). */
export function createAdminSegmentRouteError(config: AdminSegmentRouteErrorConfig = {}) {
  return function AdminSegmentRouteError({
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
      <AdminErrorPage
        error={error}
        title={config.title ?? "Admin error"}
        message={adminRouteErrorMessage(error)}
        reset={reset}
        homeHref={config.homeHref ?? "/admin"}
        homeLabel={config.homeLabel ?? "Back to admin home"}
      />
    );
  };
}
