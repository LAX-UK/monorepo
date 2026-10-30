"use client";

import {
  ErrorState,
  PageHeader,
  type StaffBreadcrumb,
  StaffBreadcrumbs,
  StaffButton,
  type StaffLinkComponent,
} from "@auction/staff-ui";
import Link from "next/link";
import type { ReactNode } from "react";

const NextLink: StaffLinkComponent = Link;

/**
 * A route that failed to load, in the staff page frame: where it sits, what failed in plain
 * words, Try again, and the way back to the list. Used by route error boundaries.
 */
export function StaffRouteError({
  title,
  breadcrumbs,
  heading,
  message,
  onRetry,
  backHref,
  backLabel,
  children,
}: {
  /** The page's title, e.g. "Legal entities". */
  title: string;
  breadcrumbs: StaffBreadcrumb[];
  /** What failed: "Could not load legal entities". */
  heading?: string;
  message: ReactNode;
  onRetry?: (() => void) | undefined;
  backHref: string;
  backLabel: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={title}
        breadcrumbs={<StaffBreadcrumbs Link={NextLink} items={breadcrumbs} />}
      />
      <div className="rounded-staff-lg border border-staff-line bg-staff-surface">
        <ErrorState
          title={heading ?? `Could not load ${title.toLowerCase()}`}
          description={message}
          action={
            <span className="flex flex-wrap items-center justify-center gap-2">
              {onRetry ? (
                <StaffButton size="sm" variant="primary" onClick={onRetry}>
                  Try again
                </StaffButton>
              ) : null}
              <StaffButton asChild size="sm" variant="secondary">
                <Link href={backHref}>{backLabel}</Link>
              </StaffButton>
            </span>
          }
        />
        {children}
      </div>
    </div>
  );
}
