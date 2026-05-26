"use client";

import { AdminErrorPage } from "@/components/admin/admin-error-page";

export default function AdminPlatformError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <AdminErrorPage
      error={error}
      title="Admin error"
      message={
        process.env.NODE_ENV === "development" ? error.message : "Please try again in a moment."
      }
      reset={reset}
    />
  );
}
