"use client";

import { CatalogListErrorShell } from "@/components/admin/catalog/catalog-list-states";
import { adminRouteErrorMessage } from "@/lib/admin/admin-route-error-message";
import { useEffect } from "react";

type CatalogListRouteErrorConfig = {
  title: string;
  listLabel: string;
  listHref: string;
};

/** Factory for catalog-module list route error boundaries. */
export function createCatalogListRouteError(config: CatalogListRouteErrorConfig) {
  return function CatalogListRouteError({
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
      <CatalogListErrorShell
        title={config.title}
        listLabel={config.listLabel}
        listHref={config.listHref}
        message={adminRouteErrorMessage(error)}
        reset={reset}
      />
    );
  };
}
