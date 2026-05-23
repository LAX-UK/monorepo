"use client";

import { CatalogListErrorShell } from "@/components/admin/catalog/catalog-list-states";
import { useEffect } from "react";

export default function AdminSalesError({
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
      title="Sales"
      listLabel="Sales"
      listHref="/admin/sales"
      reset={reset}
      {...(error.message ? { message: error.message } : {})}
    />
  );
}
