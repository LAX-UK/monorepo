"use client";

import { AdminErrorPage } from "@/components/admin/admin-error-page";
import { useEffect } from "react";

export default function AdminPlatformError({
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
      title="Admin error"
      message={
        process.env.NODE_ENV === "development" ? error.message : "Please try again in a moment."
      }
      reset={reset}
    />
  );
}
