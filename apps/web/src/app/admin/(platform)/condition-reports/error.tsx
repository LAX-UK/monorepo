"use client";

import { CatalogListErrorShell } from "@/components/admin/catalog/catalog-list-states";
import { useEffect } from "react";

export default function AdminConditionReportsError({
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
      title="Condition report requests"
      listLabel="Condition reports"
      listHref="/admin/condition-reports"
      reset={reset}
      {...(error.message ? { message: error.message } : {})}
    />
  );
}
