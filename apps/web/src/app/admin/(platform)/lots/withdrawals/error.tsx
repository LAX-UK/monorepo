"use client";

import { CatalogListErrorShell } from "@/components/admin/catalog/catalog-list-states";
import { useEffect } from "react";

export default function AdminLotWithdrawalsError({
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
      title="Lot withdrawals"
      listLabel="Lots"
      listHref="/admin/lots?lens=attention"
      reset={reset}
      {...(error.message ? { message: error.message } : {})}
    />
  );
}
