"use client";

import { CatalogListErrorShell } from "@/components/admin/catalog/catalog-list-states";
import { useEffect } from "react";

export default function AdminLotsError({
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
      title="Lots"
      listLabel="Lots"
      listHref="/admin/lots"
      reset={reset}
      {...(error.message ? { message: error.message } : {})}
    />
  );
}
