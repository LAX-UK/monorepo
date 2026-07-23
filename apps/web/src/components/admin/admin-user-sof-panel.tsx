import { AdminSectionLabel } from "@/components/admin/admin-section-label";
import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import { formatAdminUserDate } from "@/lib/admin/format-admin-user-date";
import {
  buildSofCaseDetailHref,
  buildSofListHref,
  normalizeSofListStatus,
} from "@/lib/admin/sof-list-query";
import type { AdminSourceOfFundsRow } from "@/lib/data/http/compliance.server";
import { buildAdminSofTableRow } from "@/lib/data/view-models/admin-sof-table.vm";
import { Surface } from "@auction/ui/components/surface";
import Link from "next/link";

type Props = {
  cases: AdminSourceOfFundsRow[];
};

export function AdminUserSofPanel({ cases }: Props) {
  const pending = cases.filter((c) => c.status === "pending");
  const latest = cases[0] ?? null;
  const queueHref = latest
    ? buildSofCaseDetailHref(latest.id, normalizeSofListStatus(latest.status))
    : buildSofListHref("pending");

  return (
    <Surface variant="quiet" padding="md" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <AdminSectionLabel>Source of Funds</AdminSectionLabel>
        {latest ? (
          <Link href={queueHref} className="text-xs text-link underline">
            {pending.length > 0 ? "Review case" : "View case"}
          </Link>
        ) : null}
      </div>
      {!latest ? (
        <p className="text-sm text-on-surface-variant">No Source of Funds cases on record.</p>
      ) : (
        <ul className="divide-y divide-outline-variant/30">
          {cases.slice(0, 5).map((row) => {
            const vm = buildAdminSofTableRow(row);
            return (
              <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <div className="flex min-w-0 flex-wrap items-center gap-2 text-sm">
                  <AdminStatusBadge domain="sofCase" status={vm.displayStatus} size="sm" />
                  <span className="text-on-surface-variant">
                    {vm.triggerLabel} · {vm.exposureLabel}
                  </span>
                  <span className="text-on-surface-variant">
                    Opened {formatAdminUserDate(row.createdAt)}
                  </span>
                </div>
                <Link
                  href={buildSofCaseDetailHref(row.id, normalizeSofListStatus(row.status))}
                  className="text-xs text-link underline"
                >
                  Open
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      {cases.length > 5 ? (
        <p className="text-xs text-on-surface-variant">
          Showing 5 of {cases.length} cases.{" "}
          <Link href={buildSofListHref("pending")} className="text-link underline">
            Review cases
          </Link>
        </p>
      ) : null}
    </Surface>
  );
}
