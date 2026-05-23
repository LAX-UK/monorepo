"use client";

import { CatalogListErrorShell } from "@/components/admin/catalog/catalog-list-states";
import { useEffect } from "react";

export default function AdminCategoriesError({
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
      title="Categories"
      listLabel="Categories"
      listHref="/admin/categories"
      reset={reset}
      {...(error.message ? { message: error.message } : {})}
    />
  );
}
