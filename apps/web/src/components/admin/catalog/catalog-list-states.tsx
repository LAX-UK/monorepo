"use client";

import { StaffRouteError } from "@/components/admin/staff/staff-route-error";
import type { ReactNode } from "react";

type ErrorProps = {
  title: string;
  listLabel: string;
  listHref: string;
  message?: string;
  reset?: () => void;
  children?: ReactNode;
};

/** Error recovery for a catalogue list route, in the staff page frame. */
export function CatalogListErrorShell({
  title,
  listLabel,
  listHref,
  message = "Something went wrong loading this page. Try again or return to the list.",
  reset,
  children,
}: ErrorProps) {
  return (
    <StaffRouteError
      title={title}
      breadcrumbs={[{ label: listLabel, href: listHref }, { label: "Error" }]}
      message={message}
      onRetry={reset}
      backHref={listHref}
      backLabel={`Back to ${listLabel.toLowerCase()}`}
    >
      {children}
    </StaffRouteError>
  );
}
