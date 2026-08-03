"use client";

import { AdminErrorPage } from "@/components/admin/admin-error-page";

type Props = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function AdminDashboardErrorPage({ error, reset }: Props) {
  return (
    <AdminErrorPage
      title="Dashboard unavailable"
      message="Something went wrong loading your dashboard. Try again or return to admin home."
      reset={reset}
      error={error}
    />
  );
}
