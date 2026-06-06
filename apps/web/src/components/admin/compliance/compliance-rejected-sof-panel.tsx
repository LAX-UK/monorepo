"use client";

import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import { ConfirmFormSubmit } from "@/components/admin/confirm-form-submit";
import { sofReopenAction } from "@/lib/actions/compliance";
import type { AdminSourceOfFundsRow } from "@/lib/data/http/compliance.server";
import { buildAdminSofTableRow } from "@/lib/data/view-models/admin-sof-table.vm";
import { Button } from "@auction/ui/components/button";
import Link from "next/link";

type Props = {
  rows: AdminSourceOfFundsRow[];
  canReopen: boolean;
};

export function ComplianceRejectedSofPanel({ rows, canReopen }: Props) {
  if (rows.length === 0) return null;

  return (
    <section className="space-y-3 rounded-lg border border-outline-variant/40 p-4">
      <h2 className="font-headline text-sm font-semibold text-on-surface">Rejected cases</h2>
      <p className="font-body text-sm text-on-surface-variant">
        Reopen when the buyer has supplied new evidence. This resets triage/decision and returns the
        case to the pending queue.
      </p>
      <ul className="divide-y divide-outline-variant/30">
        {rows.map((row) => {
          const vm = buildAdminSofTableRow(row);
          const formId = `sof-reopen-${row.id}`;
          return (
            <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="flex min-w-0 flex-col gap-1 text-sm sm:flex-row sm:flex-wrap sm:items-center sm:gap-2">
                <Link
                  href={`/admin/clients/${row.userId}`}
                  className="font-medium text-primary underline"
                >
                  View client profile
                </Link>
                <AdminStatusBadge domain="sofCase" status="rejected" />
                <span className="text-on-surface-variant">
                  {vm.triggerLabel} · {vm.exposureLabel}
                </span>
              </div>
              {canReopen ? (
                <form id={formId} action={sofReopenAction}>
                  <input type="hidden" name="caseId" value={row.id} />
                  <ConfirmFormSubmit
                    formId={formId}
                    variant="outline"
                    size="sm"
                    confirmTitle="Reopen rejected case?"
                    confirmBody="Maker-checker fields will be cleared and the case returns to pending review."
                    confirmLabel="Reopen"
                    tone="warning"
                  >
                    Reopen for review
                  </ConfirmFormSubmit>
                </form>
              ) : (
                <Button type="button" variant="outline" size="sm" disabled>
                  Reopen (MLRO only)
                </Button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
