import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import {
  CatalogBreadcrumbs,
  CatalogDetailMobileMeta,
  CatalogDetailShell,
  CatalogDetailTabPanel,
  DetailBoardKpiStrip,
} from "@/components/admin/catalog";
import { SofCaseReviewActionsSection } from "@/components/admin/compliance-sof-board/sof-case-context-rail";
import { SofCaseDetailClient } from "@/components/admin/compliance-sof-board/sof-case-detail-client";
import { parseAdminListReturnTarget } from "@/lib/admin/admin-list-return-context";
import {
  buildSofListHref,
  normalizeSofListStatus,
  parseSofDetailListStatus,
} from "@/lib/admin/sof-list-query";
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
  returnTo?: string | string[] | undefined;
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
  returnTo,
}: Props) {
  const listStatus = parseSofDetailListStatus({ listStatus: normalizeSofListStatus(row.status) });
  const backHref = parseAdminListReturnTarget(returnTo, buildSofListHref(listStatus));
  const statusBadge = <AdminStatusBadge domain="sofCase" status={row.displayStatus} />;

  const reviewActions = (
    <SofCaseReviewActionsSection
      row={row}
      detail={detail}
      canTriage={canTriage}
      canDecide={canDecide}
      currentUserId={currentUserId}
    />
  );

  return (
    <CatalogDetailShell
      breadcrumbs={
        <CatalogBreadcrumbs
          segments={[{ label: "Source of Funds", href: backHref }, { label: buyerLabel }]}
        />
      }
      eyebrow="Compliance review"
      title={
        <Link href={`/admin/clients/${row.userId}`} className="text-link hover:underline">
          {buyerLabel}
        </Link>
      }
      description={`${row.triggerLabel} · ${row.exposureLabel} · Opened ${row.openedLabel}`}
      meta={statusBadge}
      metaBelowTitle
      mobileMeta={<CatalogDetailMobileMeta entityId={row.id} status={statusBadge} />}
    >
      <CatalogDetailTabPanel framed={false}>
        <DetailBoardKpiStrip
          ariaLabel="Case summary"
          tiles={[
            { id: "trigger", label: "Trigger", value: row.triggerLabel, trendTone: "secondary" },
            {
              id: "exposure",
              label: "Exposure",
              value: row.exposureLabel,
              trendTone: "accent-gold",
            },
            { id: "opened", label: "Opened", value: row.openedLabel, trendTone: "muted" },
            {
              id: "documents",
              label: "Documents",
              value: String(detail.submittedDocuments.length),
              trendTone: detail.submittedDocuments.length > 0 ? "secondary" : "muted",
            },
          ]}
          className="mb-0"
        />
        {reviewActions}
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
      </CatalogDetailTabPanel>
    </CatalogDetailShell>
  );
}
