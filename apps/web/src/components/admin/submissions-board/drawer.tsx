"use client";

import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import type { AdminSubmissionTableRow } from "@/components/admin/admin-submissions-data-table";
import { AdminTechnicalIdDisclosure } from "@/components/admin/admin-technical-id-disclosure";
import { SubmissionInlineActions } from "@/components/admin/submission-inline-actions";
import { Button } from "@auction/ui/components/button";
import Link from "next/link";

export function SubmissionDrawerContent({ row }: { row: AdminSubmissionTableRow }) {
  return (
    <div className="space-y-6">
      <dl className="grid grid-cols-1 gap-3 text-sm">
        <div>
          <dt className="font-label text-[10px] uppercase text-on-surface-variant">Status</dt>
          <dd>
            <AdminStatusBadge domain="submission" status={row.status} />
          </dd>
        </div>
        <div>
          <dt className="font-label text-[10px] uppercase text-on-surface-variant">Seller</dt>
          <dd>{row.sellerPreview}</dd>
        </div>
        <div>
          <dt className="font-label text-[10px] uppercase text-on-surface-variant">Created</dt>
          <dd>{row.createdAtLabel}</dd>
        </div>
      </dl>

      <AdminTechnicalIdDisclosure items={[{ label: "Submission ID", value: row.id }]} />

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" className="min-h-11" asChild>
          <Link href={`/admin/submissions/${row.id}`}>Open full submission</Link>
        </Button>
        <SubmissionInlineActions submissionId={row.id} status={row.status} />
      </div>
    </div>
  );
}
