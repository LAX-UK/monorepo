"use client";

import type { CatalogBreadcrumbSegment } from "@/components/admin/catalog/catalog-breadcrumbs";
import { CatalogDetailErrorShell } from "@/components/admin/catalog/catalog-detail-error-shell";
import { adminRouteErrorMessage } from "@/lib/admin/admin-route-error-message";
import { useEffect } from "react";

type CatalogDetailRouteErrorConfig = {
  title: string;
  listLabel: string;
  listHref: string;
  breadcrumbs: readonly CatalogBreadcrumbSegment[];
};

/** Factory for catalog detail route error boundaries. */
export function createCatalogDetailRouteError(config: CatalogDetailRouteErrorConfig) {
  return function CatalogDetailRouteError({
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
      <CatalogDetailErrorShell
        title={config.title}
        listLabel={config.listLabel}
        listHref={config.listHref}
        breadcrumbs={config.breadcrumbs}
        message={adminRouteErrorMessage(error)}
        reset={reset}
      />
    );
  };
}
