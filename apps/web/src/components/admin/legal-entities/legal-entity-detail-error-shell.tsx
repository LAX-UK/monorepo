"use client";

import { StaffRouteError } from "@/components/admin/staff/staff-route-error";
import { adminRouteErrorMessage } from "@/lib/admin/admin-route-error-message";
import { useEffect } from "react";

/** Error recovery for a legal entity's page, in the staff page frame. */
export function LegalEntityDetailErrorShell({
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
    <StaffRouteError
      title="Legal entity"
      breadcrumbs={[{ label: "Legal entities", href: "/admin/legal-entities" }, { label: "Error" }]}
      heading="Could not load this legal entity"
      message={adminRouteErrorMessage(error)}
      onRetry={reset}
      backHref="/admin/legal-entities"
      backLabel="Back to legal entities"
    />
  );
}
