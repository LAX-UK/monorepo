"use client";

import { StaffRouteError } from "@/components/admin/staff/staff-route-error";
import type { ReactNode } from "react";

type Props = {
  title: string;
  backHref: string;
  backLabel: string;
  message?: string;
  reset?: () => void;
  children?: ReactNode;
};

/** Error recovery for a people-module list route, in the staff page frame. */
export function PeopleListErrorShell({
  title,
  backHref,
  backLabel,
  message = "Something went wrong loading this page. Try again or return to the list.",
  reset,
  children,
}: Props) {
  return (
    <StaffRouteError
      title={title}
      breadcrumbs={[{ label: title }, { label: "Error" }]}
      message={message}
      onRetry={reset}
      backHref={backHref}
      backLabel={backLabel}
    >
      {children}
    </StaffRouteError>
  );
}
