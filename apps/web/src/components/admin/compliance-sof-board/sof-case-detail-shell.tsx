"use client";

import { SofCaseReviewActionsSection } from "@/components/admin/compliance-sof-board/sof-case-context-rail";
import { SofCaseDetailClient } from "@/components/admin/compliance-sof-board/sof-case-detail-client";
import { SofCaseTimeline } from "@/components/admin/compliance-sof-board/sof-case-timeline";
import { StaffBreadcrumbs } from "@/components/admin/staff/staff-breadcrumbs";
import { usePinPageAction } from "@/components/admin/staff/use-pin-page-action";
import { parseAdminListReturnTarget } from "@/lib/admin/admin-list-return-context";
import {
  buildSofListHref,
  normalizeSofListStatus,
  parseSofDetailListStatus,
} from "@/lib/admin/sof-list-query";
import { staffStatus } from "@/lib/admin/staff-kit-status";
import type { AdminSourceOfFundsDetail } from "@/lib/data/http/compliance.server";
import type { AdminSofTableRow } from "@/lib/data/view-models/admin-sof-table.vm";
import { buildSofTimeline } from "@/lib/data/view-models/admin-sof-timeline.vm";
import {
  DetailPage,
  OverflowMenu,
  type StaffLinkComponent,
  StatGrid,
  StatusBadge,
} from "@auction/staff-ui";
import Link from "next/link";

const NextLink: StaffLinkComponent = Link;

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

/**
 * A source-of-funds case on the staff record template: the buyer and the case status, a summary,
 * then the workflow, the review actions and the evidence. The review actions are the page's
 * primary work, so there is no header button; the overflow opens the buyer.
 */
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
  const status = staffStatus("sofCase", row.displayStatus);
  const pin = usePinPageAction(`Source of Funds · ${buyerLabel}`);
  const documents = detail.submittedDocuments.length;

  return (
    <DetailPage
      breadcrumbs={
        <StaffBreadcrumbs
          items={[{ label: "Source of Funds", href: backHref }, { label: buyerLabel }]}
        />
      }
      title={buyerLabel}
      status={
        <StatusBadge tone={status.tone} live={status.live ?? false}>
          {status.label}
        </StatusBadge>
      }
      overflow={
        <OverflowMenu
          label="More case actions"
          Link={NextLink}
          actions={[
            pin,
            { id: "buyer", label: "Open buyer", href: `/admin/clients/${row.userId}` },
          ]}
        />
      }
    >
      <StatGrid
        label="Case summary"
        items={[
          { id: "trigger", label: "Trigger", value: row.triggerLabel },
          { id: "exposure", label: "Exposure", value: row.exposureLabel },
          { id: "opened", label: "Opened", value: row.openedLabel },
          { id: "documents", label: "Documents", value: String(documents) },
        ]}
      />
      <SofCaseTimeline
        steps={buildSofTimeline({ row, detail, canTriage, canDecide, currentUserId })}
      />
      <SofCaseReviewActionsSection
        row={row}
        detail={detail}
        canTriage={canTriage}
        canDecide={canDecide}
        currentUserId={currentUserId}
      />
      <SofCaseDetailClient
        row={row}
        detail={detail}
        readOnly={row.status !== "pending"}
        {...(success != null ? { success } : {})}
        {...(error != null ? { error } : {})}
      />
    </DetailPage>
  );
}
