"use client";

import { CatalogDetailErrorShell } from "@/components/admin/catalog/catalog-detail-error-shell";
import { useEffect } from "react";

export default function AdminSubmissionDetailError({
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
    <CatalogDetailErrorShell
      title="Submission"
      listLabel="Submissions"
      listHref="/admin/submissions"
      breadcrumbs={[{ label: "Submissions", href: "/admin/submissions" }]}
      reset={reset}
      {...(error.message ? { message: error.message } : {})}
    />
  );
}
