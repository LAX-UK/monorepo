import { CatalogInfoAside } from "@/components/admin/catalog/catalog-info-aside";
import {
  ActivitySnapshotRail,
  KpiStackRail,
  QuickActionsRail,
  RelatedEntitiesRail,
} from "@/components/admin/detail-rail";
import { submissionDetailTabHref } from "@/components/admin/submission-detail/submission-detail-types";
import { domainEventLabel } from "@/lib/admin/domain-event-labels";
import type { AdminDomainEventRow } from "@/lib/data/http/admin.server";
import { formatDateTime } from "@/lib/ui/format";
import type { ItemSubmission } from "@auction/types";
import { Building2, Package } from "lucide-react";
import type { ReactNode } from "react";

type Props = {
  submissionId: string;
  submission: ItemSubmission;
  documentCount: number;
  submitterLegalEntityId: string | null;
  submitterDisplayName: string | null;
  status?: ReactNode;
  activityEvents?: readonly AdminDomainEventRow[];
};

export function SubmissionContextRail({
  submissionId,
  submission,
  documentCount,
  submitterLegalEntityId,
  submitterDisplayName,
  status,
  activityEvents = [],
}: Props) {
  const related = [
    ...(submitterLegalEntityId
      ? [
          {
            id: submitterLegalEntityId,
            kind: "Seller",
            label: submitterDisplayName ?? "Legal entity",
            href: `/admin/legal-entities/${submitterLegalEntityId}`,
            icon: <Building2 className="size-4" aria-hidden />,
          },
        ]
      : []),
    ...(submission.convertedLotId
      ? [
          {
            id: submission.convertedLotId,
            kind: "Lot",
            label: "Converted lot",
            href: `/admin/lots/${submission.convertedLotId}`,
            icon: <Package className="size-4" aria-hidden />,
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-6">
      <CatalogInfoAside
        entityId={submissionId}
        updatedAt={submission.updatedAt}
        {...(status ? { status } : {})}
      />
      <div className="space-y-6 rounded-xl border border-border-hairline bg-surface-container-low/60 p-5">
        <KpiStackRail
          items={[
            {
              id: "status",
              label: "Status",
              value: submission.status.replaceAll("_", " "),
            },
            {
              id: "documents",
              label: "Documents",
              value: String(documentCount),
            },
            {
              id: "submitted",
              label: "Submitted",
              value: formatDateTime(submission.createdAt).split(",")[0] ?? "—",
            },
          ]}
        />
        <QuickActionsRail
          actions={[
            {
              id: "decision",
              label: "Open decision",
              href: submissionDetailTabHref(submissionId, "decision"),
              variant: "default",
            },
            {
              id: "documents",
              label: "View documents",
              href: submissionDetailTabHref(submissionId, "documents"),
              variant: "outline",
            },
            {
              id: "queue",
              label: "Back to queue",
              href: "/admin/submissions",
              variant: "outline",
            },
          ]}
        />
        {related.length > 0 ? <RelatedEntitiesRail items={related} /> : null}
        {activityEvents.length > 0 ? (
          <ActivitySnapshotRail
            events={activityEvents.map((e) => ({
              id: e.id,
              label: domainEventLabel(e.eventType),
              at: e.occurredAt.toISOString(),
              actor: e.actorUserId,
            }))}
          />
        ) : null}
      </div>
    </div>
  );
}
