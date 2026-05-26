"use client";

import { AdminErrorPage } from "@/components/admin/admin-error-page";

type AdminRouteErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

/** Shared client error boundary for admin route segments. */
export default function AdminRouteError({ error, reset }: AdminRouteErrorProps) {
  const message =
    process.env.NODE_ENV === "development"
      ? error.message
      : "Something went wrong loading this page. Try again or return to the cockpit.";

  return <AdminErrorPage error={error} message={message} reset={reset} />;
}
