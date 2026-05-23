"use client";

import { AdminErrorPage } from "@/components/admin/admin-error-page";
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

  return <AdminErrorPage reset={reset} />;
}
