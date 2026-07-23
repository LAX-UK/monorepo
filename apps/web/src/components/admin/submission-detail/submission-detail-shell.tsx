"use client";

import { AdminPinPageButton } from "@/components/admin/admin-pin-page-button";
import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import {
  CatalogBreadcrumbs,
  CatalogDetailMobileMeta,
  CatalogDetailShell,
  CatalogDetailTabNav,
  type CatalogMobileAction,
} from "@/components/admin/catalog";
import { SubmissionAssignControl } from "@/components/admin/submission-actions/submission-assign-control";
import { SubmissionDetailMetaRow } from "@/components/admin/submission-detail/submission-detail-meta-row";
import { SubmissionDetailMobileTrailing } from "@/components/admin/submission-detail/submission-detail-mobile-trailing";
import { submissionDetailTabHref } from "@/components/admin/submission-detail/submission-detail-types";
import { buildSubmissionHeaderBadges } from "@/lib/admin/submissions/submission-header-badges";
import type { ItemSubmission } from "@auction/types";
import { Button } from "@auction/ui/components/button";
import { DotStatusPill } from "@auction/ui/components/dot-status-pill";
import Link from "next/link";
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
  children,
}: Props) {
  const pathname = usePathname();
  const status = submission.status;
  const statusBadge = <AdminStatusBadge domain="submission" status={status} />;
  const headerBadges = useMemo(() => buildSubmissionHeaderBadges(submission), [submission]);
  const isDecisionTab = pathname.endsWith("/decision");
  const decisionHref = submissionDetailTabHref(submissionId, "decision");
  const showDecisionCta =
    status === "submitted" || status === "under_review" || status === "approved";

  const mobileActions = useMemo((): CatalogMobileAction[] => {
    return [
      {
        id: "back-queue",
        label: "Submissions",
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
      metaBelowTitle
      breadcrumbs={
        <CatalogBreadcrumbs
          segments={[{ label: "Submissions", href: "/admin/submissions" }, { label: title }]}
        />
      }
      eyebrow="Submission"
      title={title}
      meta={
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            {statusBadge}
            {headerBadges.map((badge) => (
              <DotStatusPill key={badge.id} label={badge.label} tone={badge.tone} />
            ))}
          </div>
          <SubmissionDetailMetaRow
            submitterLegalEntityId={submitterLegalEntityId}
            submitterDisplayName={submitterDisplayName}
            convertedLotId={submission.convertedLotId}
            createdAt={submission.createdAt}
            updatedAt={submission.updatedAt}
          />
        </div>
      }
      actions={
        <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
          <SubmissionAssignControl
            submissionId={submissionId}
            status={status}
            assignedToUserId={submission.assignedToUserId}
            currentUserId={currentUserId}
          />
          {showDecisionCta ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="hidden min-h-9 lg:inline-flex"
              asChild
            >
              <Link href={decisionHref}>
                {status === "approved" ? "Convert to lot" : "Open decision"}
              </Link>
            </Button>
          ) : null}
          <AdminPinPageButton label={title} />
        </div>
      }
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
            showDecisionCta ? (
              <a
                href={decisionHref}
                className="font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-link hover:underline"
              >
                {status === "approved" ? "Convert to lot →" : "Open decision →"}
              </a>
            ) : undefined
          }
        />
      }
      stickySubnav={
        <CatalogDetailTabNav
          tabs={tabSpecs}
          entityKind="submission"
          aria-label="Submission sections"
        />
      }
    >
      {children}
    </CatalogDetailShell>
  );
}
