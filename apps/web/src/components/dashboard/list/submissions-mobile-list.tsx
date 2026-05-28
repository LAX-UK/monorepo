"use client";

import {
  DashboardListRowCard,
  DashboardMobileList,
} from "@/components/dashboard/primitives/dashboard-list-row-card";
import type { SubmissionTableRow } from "@/components/dashboard/submissions-board";
import { SubmissionStatusBadge } from "@/components/ui/submission-status-badge";
import { Button } from "@auction/ui/components/button";
import Link from "next/link";

type Props = {
  rows: SubmissionTableRow[];
};

export function SubmissionsMobileList({ rows }: Props) {
  return (
    <DashboardMobileList>
      {rows.map((row) => (
        <li key={row.id}>
          <DashboardListRowCard
            title={
              <Link
                href={`/dashboard/submissions/${row.id}`}
                className="block truncate font-headline text-sm font-semibold text-on-surface underline-offset-4 hover:underline"
              >
                {row.title}
              </Link>
            }
            subtitle={
              <p className="mt-1 font-body text-xs tabular-nums text-on-surface-variant">
                Updated {new Date(row.updatedAt).toLocaleString()}
              </p>
            }
            badges={<SubmissionStatusBadge status={row.status} />}
            footer={
              <>
                <Button variant="secondaryOutline" size="sm" asChild>
                  <Link href={`/dashboard/submissions/${row.id}`}>View</Link>
                </Button>
                {row.status === "draft" ? (
                  <Button variant="primary" size="sm" asChild>
                    <Link href={`/dashboard/submissions/${row.id}`}>Edit</Link>
                  </Button>
                ) : null}
              </>
            }
          />
        </li>
      ))}
    </DashboardMobileList>
  );
}
