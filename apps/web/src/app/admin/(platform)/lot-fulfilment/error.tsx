"use client";

import { CatalogListErrorShell } from "@/components/admin/catalog/catalog-list-states";
import { useEffect } from "react";

export default function AdminLotFulfilmentError({
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
      title="Lot fulfilment"
      listLabel="Lot fulfilment"
      listHref="/admin/lot-fulfilment"
      reset={reset}
      {...(error.message ? { message: error.message } : {})}
    />
  );
}
