"use client";

import { StaffRouteError } from "@/components/admin/staff/staff-route-error";
import { adminRouteErrorMessage } from "@/lib/admin/admin-route-error-message";
import {
  type SofListStatus,
  buildSofListHref,
  parseSofDetailListStatus,
} from "@/lib/admin/sof-list-query";
import { useSearchParams } from "next/navigation";
import { useEffect } from "react";

/** Error recovery for a Source of Funds case, in the staff page frame. */
export function SofCaseDetailErrorShell({
  error,
  reset,
  listStatus: listStatusProp,
}: {
  error: Error & { digest?: string };
  reset: () => void;
  listStatus?: SofListStatus;
}) {
  const searchParams = useSearchParams();
  const listStatus = listStatusProp ?? parseSofDetailListStatus(searchParams);
  const backHref = buildSofListHref(listStatus);

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <StaffRouteError
      title="Source of Funds case"
      breadcrumbs={[{ label: "Source of Funds", href: backHref }, { label: "Error" }]}
      heading="Could not load this case"
      message={adminRouteErrorMessage(error)}
      onRetry={reset}
      backHref={backHref}
      backLabel="Back to Source of Funds"
    />
  );
}
