"use client";

import { AdminErrorPage } from "@/components/admin/admin-error-page";

type Props = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function AdminDashboardErrorPage({ error, reset }: Props) {
  return (
    <AdminErrorPage
      title="Overview could not load"
      message="Something went wrong loading your work and numbers. Try again in a moment."
      reset={reset}
      error={error}
    />
  );
}
