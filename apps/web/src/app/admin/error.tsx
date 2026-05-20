"use client";

import { AdminErrorPage } from "@/components/admin/admin-error-page";
import { useEffect } from "react";

export default function AdminError({
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
    <AdminErrorPage
      message={
        process.env.NODE_ENV === "development"
          ? error.message
          : "An admin operation failed unexpectedly. Try again or head to the cockpit."
      }
      reset={reset}
    />
  );
}
