"use client";

import { AdminPinPageButton } from "@/components/admin/admin-pin-page-button";
import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import {
  CatalogBreadcrumbs,
  CatalogDetailMobileMeta,
  CatalogDetailShell,
  CatalogDetailStickyMiniBar,
  CatalogDetailTabNav,
  type CatalogMobileAction,
} from "@/components/admin/catalog";
import { SubmissionContextRail } from "@/components/admin/submission-detail/submission-context-rail";
import { SubmissionDetailMobileTrailing } from "@/components/admin/submission-detail/submission-detail-mobile-trailing";
import { submissionDetailTabHref } from "@/components/admin/submission-detail/submission-detail-types";
import type { AdminDomainEventRow } from "@/lib/data/http/admin.server";
import type { ItemSubmission } from "@auction/types";
import { usePathname } from "next/navigation";
import { type ReactNode, useMemo } from "react";

type Props = {
  submissionId: string;
  submission: ItemSubmission;
  title: string;
  documentCount: number;
  submitterLegalEntityId: string | null;
  submitterDisplayName: string | null;
  currentUserId: string;
  asideDecision: ReactNode;
  activityEvents?: readonly AdminDomainEventRow[];
  children: ReactNode;
};

export function SubmissionDetailShell({
  submissionId,
  submission,
  title,
  documentCount,
  submitterLegalEntityId,
  submitterDisplayName,
  currentUserId,
  asideDecision,
  activityEvents = [],
  children,
}: Props) {
  const pathname = usePathname();
  const status = submission.status;
  const statusBadge = <AdminStatusBadge domain="submission" status={status} />;
  const isDecisionTab = pathname.endsWith("/decision");

  const mobileActions = useMemo((): CatalogMobileAction[] => {
    return [
      {
        id: "back-queue",
        label: "Queue",
        variant: "secondary",
        href: "/admin/submissions",
      },
    ];
  }, []);

  const tabSpecs = [
    { id: "overview", label: "Overview", href: submissionDetailTabHref(submissionId, "overview") },
    {
      id: "documents",
      label: `Documents${documentCount > 0 ? ` (${documentCount})` : ""}`,
      href: submissionDetailTabHref(submissionId, "documents"),
    },
    {
      id: "decision",
      label: "Decision",
      href: submissionDetailTabHref(submissionId, "decision"),
      ...(status === "submitted" || status === "under_review" ? { badge: "pending" as const } : {}),
    },
  ];

  return (
    <CatalogDetailShell
      breadcrumbs={
        <CatalogBreadcrumbs
          segments={[{ label: "Submissions", href: "/admin/submissions" }, { label: title }]}
        />
      }
      eyebrow="Submission"
      title={title}
      meta={statusBadge}
      actions={<AdminPinPageButton label={title} />}
      mobileActions={mobileActions}
      mobileActionBarTrailing={
        <SubmissionDetailMobileTrailing
          submissionId={submissionId}
          status={status}
          showDecisionActions={isDecisionTab}
        />
      }
      mobileMeta={
        <CatalogDetailMobileMeta
          entityId={submissionId}
          updatedAt={submission.updatedAt}
          status={statusBadge}
          quickLinks={[
            ...(submitterLegalEntityId
              ? [
                  {
                    label: submitterDisplayName ?? "Seller",
                    href: `/admin/legal-entities/${submitterLegalEntityId}`,
                  },
                ]
              : []),
            ...(submission.convertedLotId
              ? [{ label: "Lot", href: `/admin/lots/${submission.convertedLotId}` }]
              : []),
          ]}
          primaryAction={
            status === "submitted" || status === "under_review" ? (
              <a
                href={submissionDetailTabHref(submissionId, "decision")}
                className="font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-primary hover:underline"
              >
                Open decision →
              </a>
            ) : undefined
          }
        />
      }
      aside={
        <>
          <SubmissionContextRail
            submissionId={submissionId}
            submission={submission}
            documentCount={documentCount}
            submitterLegalEntityId={submitterLegalEntityId}
            submitterDisplayName={submitterDisplayName}
            currentUserId={currentUserId}
            status={statusBadge}
            activityEvents={activityEvents}
          />
          {!isDecisionTab ? <div className="hidden min-w-0 lg:block">{asideDecision}</div> : null}
        </>
      }
      stickySubnav={
        <>
          <CatalogDetailTabNav
            tabs={tabSpecs}
            entityKind="submission"
            entityId={submissionId}
            aria-label="Submission sections"
          />
          <CatalogDetailStickyMiniBar
            items={[
              { id: "status", label: "Status", value: statusBadge },
              { id: "documents", label: "Documents", value: String(documentCount) },
            ]}
          />
        </>
      }
    >
      {children}
    </CatalogDetailShell>
  );
}
