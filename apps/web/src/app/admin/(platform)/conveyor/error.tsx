"use client";

import { CatalogListErrorShell } from "@/components/admin/catalog/catalog-list-states";
import { useEffect } from "react";

export default function AdminConveyorError({
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
      title="Conveyor"
      listLabel="Conveyor"
      listHref="/admin/conveyor"
      reset={reset}
      {...(error.message ? { message: error.message } : {})}
    />
  );
}
