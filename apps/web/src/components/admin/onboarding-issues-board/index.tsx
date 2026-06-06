"use client";

import { AdminEmptyState } from "@/components/admin/admin-empty-state";
import { AdminQueueCountBadge, AdminStatusBadge } from "@/components/admin/admin-status-badge";
import {
  artistColumns,
  docColumns,
  entityColumns,
  kycColumns,
  kycUserLabel,
  orgColumns,
} from "@/components/admin/onboarding-issues-board/columns";
import { OnboardingIssuesTable } from "@/components/admin/onboarding-issues-board/issues-table";
import { AdminDetailTabs } from "@/components/dashboard/primitives/admin-detail-tabs";
import type { AdminOnboardingIssuesPayload } from "@/lib/data/http/admin.server";
import { formatDateTime } from "@/lib/ui/format";
import Link from "next/link";
import { useMemo } from "react";

export function OnboardingIssuesBoard({
  data,
  defaultTab = "entities",
}: {
  data: AdminOnboardingIssuesPayload;
  defaultTab?: string;
}) {
  const totalIssues =
    data.entitiesPendingReview.length +
    data.artistsPendingApproval.length +
    data.staleKycSessions.length +
    data.staleLeadOrganisations.length +
    data.documentsAwaitingReview.length;

  const entityCols = useMemo(() => entityColumns(), []);
  const artistCols = useMemo(() => artistColumns(), []);
  const kycCols = useMemo(() => kycColumns(), []);
  const orgCols = useMemo(() => orgColumns(), []);
  const docCols = useMemo(() => docColumns(), []);

  const tabs = [
    {
      value: "entities",
      label: "Entities",
      ...(data.entitiesPendingReview.length > 0
        ? {
            badge: <AdminQueueCountBadge count={data.entitiesPendingReview.length} />,
          }
        : {}),
      content: (
        <OnboardingIssuesTable
          rows={data.entitiesPendingReview}
          columns={entityCols}
          emptyTitle="No entities in review."
          renderCard={(r) => (
            <>
              <p className="font-medium">{r.displayName}</p>
              <div className="mt-1">
                <AdminStatusBadge domain="legalEntity" status={r.status} />
              </div>
              <Link
                href={`/admin/legal-entities/${r.id}`}
                className="mt-2 inline-block text-sm text-primary underline"
              >
                Open
              </Link>
            </>
          )}
        />
      ),
    },
    {
      value: "artists",
      label: "Artists",
      ...(data.artistsPendingApproval.length > 0
        ? {
            badge: <AdminQueueCountBadge count={data.artistsPendingApproval.length} />,
          }
        : {}),
      content: (
        <OnboardingIssuesTable
          rows={data.artistsPendingApproval}
          columns={artistCols}
          emptyTitle="No pending artists."
          renderCard={(r) => (
            <>
              <p className="font-medium">{r.displayName}</p>
              <Link
                href={`/admin/artists/${r.id}/edit`}
                className="mt-2 inline-block text-sm text-primary underline"
              >
                Review
              </Link>
            </>
          )}
        />
      ),
    },
    {
      value: "kyc",
      label: "KYC sessions",
      ...(data.staleKycSessions.length > 0
        ? {
            badge: <AdminQueueCountBadge count={data.staleKycSessions.length} />,
          }
        : {}),
      content: (
        <OnboardingIssuesTable
          rows={data.staleKycSessions}
          columns={kycCols}
          emptyTitle="No stale verification sessions."
          renderCard={(r) => (
            <>
              <p className="font-medium">{kycUserLabel(r)}</p>
              <p className="mt-1 text-xs text-on-surface-variant">{r.provider}</p>
              <div className="mt-1">
                <AdminStatusBadge domain="kyc" status={r.status} />
              </div>
              <p className="mt-1 text-xs text-on-surface-variant">{formatDateTime(r.createdAt)}</p>
              <Link
                href={`/admin/clients/${encodeURIComponent(r.userId)}`}
                className="mt-2 inline-block text-sm text-primary underline"
              >
                Open client
              </Link>
            </>
          )}
        />
      ),
    },
    {
      value: "orgs",
      label: "Lead orgs",
      ...(data.staleLeadOrganisations.length > 0
        ? {
            badge: <AdminQueueCountBadge count={data.staleLeadOrganisations.length} />,
          }
        : {}),
      content: (
        <OnboardingIssuesTable
          rows={data.staleLeadOrganisations}
          columns={orgCols}
          emptyTitle="No stale lead organisations."
          renderCard={(r) => (
            <>
              <p className="font-medium">{r.displayName}</p>
              <p className="mt-1 text-xs text-on-surface-variant">
                Created {new Date(r.createdAt).toLocaleDateString("en-GB")}
              </p>
              <Link
                href={`/admin/legal-entities/${r.id}`}
                className="mt-2 inline-block text-sm text-primary underline"
              >
                Open entity
              </Link>
            </>
          )}
        />
      ),
    },
    {
      value: "documents",
      label: "Documents",
      ...(data.documentsAwaitingReview.length > 0
        ? {
            badge: <AdminQueueCountBadge count={data.documentsAwaitingReview.length} />,
          }
        : {}),
      content: (
        <OnboardingIssuesTable
          rows={data.documentsAwaitingReview}
          columns={docCols}
          emptyTitle="No pending entity documents."
          renderCard={(r) => (
            <>
              <p className="font-medium">{r.entityDisplayName}</p>
              <p className="mt-1 text-xs text-on-surface-variant">Document awaiting review</p>
              <Link
                href={`/admin/legal-entities/${r.legalEntityId}`}
                className="mt-2 inline-block text-sm text-primary underline"
              >
                Entity
              </Link>
            </>
          )}
        />
      ),
    },
  ] as const;

  if (totalIssues === 0) {
    return (
      <AdminEmptyState
        title="All onboarding queues are clear"
        description="New legal entities, artists, stale verification sessions, lead organisations, and documents will appear here when they need staff review."
      />
    );
  }

  return <AdminDetailTabs defaultValue={defaultTab} syncUrl tabs={tabs} />;
}
