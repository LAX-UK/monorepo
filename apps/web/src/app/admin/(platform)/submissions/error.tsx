"use client";

import { CatalogListErrorShell } from "@/components/admin/catalog/catalog-list-states";
import { useEffect } from "react";

export default function AdminSubmissionsError({
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
      title="Submissions"
      listLabel="Submissions"
      listHref="/admin/submissions"
      reset={reset}
      {...(error.message ? { message: error.message } : {})}
    />
  );
}
