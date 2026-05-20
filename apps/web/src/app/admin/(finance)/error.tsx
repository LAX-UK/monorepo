"use client";

import { AdminErrorPage } from "@/components/admin/admin-error-page";
import { useEffect } from "react";

export default function FinanceAdminError({
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
      title="Finance admin error"
      message={
        process.env.NODE_ENV === "development"
          ? error.message
          : "Something went wrong loading this finance page. Try again or return to payments."
      }
      reset={reset}
    />
  );
}
