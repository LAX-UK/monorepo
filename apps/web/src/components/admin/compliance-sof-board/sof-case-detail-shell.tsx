import { AdminEntityDetailShell } from "@/components/admin/admin-entity-detail-shell";
import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import { SofCaseContextRail } from "@/components/admin/compliance-sof-board/sof-case-context-rail";
import { SofCaseDetailClient } from "@/components/admin/compliance-sof-board/sof-case-detail-client";
import { buildSofListHref, normalizeSofListStatus } from "@/lib/admin/sof-list-query";
import type { AdminSourceOfFundsDetail } from "@/lib/data/http/compliance.server";
import type { AdminSofTableRow } from "@/lib/data/view-models/admin-sof-table.vm";
import Link from "next/link";

type Props = {
  row: AdminSofTableRow;
  detail: AdminSourceOfFundsDetail;
  buyerLabel: string;
  canTriage: boolean;
  canDecide: boolean;
  currentUserId: string;
  success?: string | null;
  error?: string | null;
};

export function SofCaseDetailShell({
  row,
  detail,
  buyerLabel,
  canTriage,
  canDecide,
  currentUserId,
  success,
  error,
}: Props) {
  const listStatus = normalizeSofListStatus(row.status);

  return (
    <AdminEntityDetailShell
      detailHeader
      detailHeaderSticky={false}
      backHref={buildSofListHref(listStatus)}
      backLabel="Source of Funds"
      eyebrow="Compliance review"
      title={
        <Link href={`/admin/clients/${row.userId}`} className="text-link hover:underline">
          {buyerLabel}
        </Link>
      }
      description={`${row.triggerLabel} · ${row.exposureLabel} · Opened ${row.openedLabel}`}
      meta={<AdminStatusBadge domain="sofCase" status={row.displayStatus} />}
      rail={
        <SofCaseContextRail
          row={row}
          detail={detail}
          canTriage={canTriage}
          canDecide={canDecide}
          currentUserId={currentUserId}
        />
      }
      railSticky={false}
    >
      <SofCaseDetailClient
        row={row}
        detail={detail}
        readOnly={row.status !== "pending"}
        canTriage={canTriage}
        canDecide={canDecide}
        currentUserId={currentUserId}
        {...(success != null ? { success } : {})}
        {...(error != null ? { error } : {})}
      />
    </AdminEntityDetailShell>
  );
}
