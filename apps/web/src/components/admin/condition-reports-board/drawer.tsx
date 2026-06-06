"use client";

import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import { AdminTechnicalIdDisclosure } from "@/components/admin/admin-technical-id-disclosure";
import { ConditionReportDeclineButton } from "@/components/admin/condition-report-decline-button";
import { ConditionReportFulfillForm } from "@/components/admin/condition-report-fulfill-form";
import { ConfirmFormSubmit } from "@/components/admin/confirm-form-submit";
import { adminMarkConditionReportInProgressAction } from "@/lib/actions/admin";
import type { AdminConditionReportRequestRow } from "@/lib/data/http/admin.server";
import { formatDateTime } from "@/lib/ui/format";
import Link from "next/link";

export function ConditionReportDrawerContent({ row }: { row: AdminConditionReportRequestRow }) {
  const terminal = row.status === "fulfilled" || row.status === "declined";
  const markInProgressFormId = `condition-report-progress-${row.id}`;
  const requesterLabel = row.requesterEmail?.trim() || "View client";

  return (
    <div className="space-y-6">
      <div>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <Link
            href={`/admin/lots/${row.lotId}`}
            className="font-headline text-base text-primary hover:underline"
          >
            {row.lotTitle ?? "View lot"}
          </Link>
          <AdminStatusBadge domain="conditionReport" status={row.status} />
        </div>
        <p className="mt-1 text-sm text-on-surface-variant">
          <Link
            href={`/admin/clients/${row.requestedByUserId}`}
            className="text-primary hover:underline"
          >
            {requesterLabel}
          </Link>
          {row.createdAt ? ` · ${formatDateTime(row.createdAt)}` : ""}
        </p>
      </div>
      {row.requestNote ? (
        <blockquote className="rounded-md bg-surface-container-low p-3 text-sm text-on-surface-variant">
          {row.requestNote}
        </blockquote>
      ) : null}

      <AdminTechnicalIdDisclosure
        items={[
          { label: "Request ID", value: row.id },
          { label: "Lot ID", value: row.lotId },
          { label: "Requester user ID", value: row.requestedByUserId },
        ]}
      />

      {terminal ? (
        <div className="rounded-lg border border-border-hairline bg-surface-container-low p-4">
          <p className="font-label text-xs font-semibold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
            Request closed
          </p>
          <p className="mt-2 text-sm text-on-surface-variant">
            {row.status === "fulfilled"
              ? `Fulfilled${row.fulfilledAt ? ` on ${formatDateTime(row.fulfilledAt)}` : ""}.`
              : "Declined."}
          </p>
          {row.responseNote ? (
            <p className="mt-3 whitespace-pre-wrap text-sm text-on-surface">{row.responseNote}</p>
          ) : null}
        </div>
      ) : (
        <>
          {row.status === "pending" ? (
            <form id={markInProgressFormId} action={adminMarkConditionReportInProgressAction}>
              <input type="hidden" name="requestId" value={row.id} />
              <ConfirmFormSubmit
                formId={markInProgressFormId}
                size="sm"
                variant="outline"
                className="min-h-9"
                confirmTitle="Mark condition report in progress?"
                confirmBody="This moves the request into the in-progress queue so staff can see it has been picked up."
                confirmLabel="Mark in progress"
                tone="info"
              >
                Mark in progress
              </ConfirmFormSubmit>
            </form>
          ) : null}
          <ConditionReportFulfillForm requestId={row.id} />
          <ConditionReportDeclineButton requestId={row.id} />
        </>
      )}
    </div>
  );
}
