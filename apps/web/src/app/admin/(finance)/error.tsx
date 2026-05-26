"use client";

import { AdminErrorPage } from "@/components/admin/admin-error-page";

export default function FinanceAdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <AdminErrorPage
      error={error}
      title="Finance admin error"
      message={
        process.env.NODE_ENV === "development"
          ? error.message
          : "Something went wrong loading this finance page. Try again or return to payments."
      }
      reset={reset}
      homeHref="/admin/payments"
      homeLabel="Back to payments"
    />
  );
}
