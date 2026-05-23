"use client";

import { CatalogListErrorShell } from "@/components/admin/catalog/catalog-list-states";
import { useEffect } from "react";

export default function AdminArtistsError({
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
      title="Artists"
      listLabel="Artists"
      listHref="/admin/artists"
      reset={reset}
      {...(error.message ? { message: error.message } : {})}
    />
  );
}
