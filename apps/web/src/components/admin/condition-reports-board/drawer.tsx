"use client";

import { ConditionReportDeclineButton } from "@/components/admin/condition-report-decline-button";
import { ConditionReportFulfillForm } from "@/components/admin/condition-report-fulfill-form";
import type { AdminConditionReportRequestRow } from "@/lib/data/http/admin.server";
import { formatDateTime } from "@/lib/ui/format";
import Link from "next/link";

export function ConditionReportDrawerContent({ row }: { row: AdminConditionReportRequestRow }) {
  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/admin/lots/${row.lotId}`}
          className="font-headline text-base text-primary hover:underline"
        >
          {row.lotTitle ?? row.lotId}
        </Link>
        <p className="mt-1 text-sm text-on-surface-variant">
          From {row.requesterEmail ?? row.requestedByUserId}
          {row.createdAt ? ` · ${formatDateTime(row.createdAt)}` : ""}
        </p>
      </div>
      {row.requestNote ? (
        <blockquote className="rounded-md bg-surface-container-low p-3 text-sm text-on-surface-variant">
          {row.requestNote}
        </blockquote>
      ) : null}
      <ConditionReportFulfillForm requestId={row.id} />
      <ConditionReportDeclineButton requestId={row.id} />
    </div>
  );
}
