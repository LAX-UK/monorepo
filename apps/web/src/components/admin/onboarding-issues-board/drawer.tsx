"use client";

import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import { kycUserLabel } from "@/components/admin/onboarding-issues-board/columns";
import { OnboardingIssueAgeCell } from "@/components/admin/onboarding-issues-board/onboarding-issue-age-cell";
import type {
  AdminOnboardingIssueRow,
  AdminOnboardingStaleLeadRow,
} from "@/lib/data/http/admin-onboarding-issues.shared";
import type { OnboardingTabId } from "@/lib/data/view-models/admin-onboarding-issues.vm";
import { formatDateTime } from "@/lib/ui/format";
import Link from "next/link";

function isKycRow(
  row: AdminOnboardingIssueRow,
): row is Extract<AdminOnboardingIssueRow, { userId: string }> {
  return "userId" in row && "provider" in row;
}

function isDocumentRow(
  row: AdminOnboardingIssueRow,
): row is Extract<AdminOnboardingIssueRow, { legalEntityId: string }> {
  return "legalEntityId" in row && "entityDisplayName" in row;
}

function isStaleLeadRow(
  row: AdminOnboardingIssueRow,
  tab: OnboardingTabId,
): row is AdminOnboardingStaleLeadRow {
  return tab === "orgs" && "createdAt" in row && "displayName" in row && !("userId" in row);
}

type Props = {
  tab: OnboardingTabId;
  row: AdminOnboardingIssueRow;
};

export function OnboardingIssueDrawerContent({ tab, row }: Props) {
  if (tab === "entities" && "status" in row && "displayName" in row) {
    return (
      <div className="space-y-4">
        <div>
          <p className="font-medium text-on-surface">{row.displayName}</p>
          <div className="mt-2">
            <AdminStatusBadge domain="legalEntity" status={row.status} />
          </div>
        </div>
        <Link href={`/admin/legal-entities/${row.id}`} className="text-sm text-link underline">
          Open legal entity
        </Link>
      </div>
    );
  }

  if (tab === "artists" && "displayName" in row && !("userId" in row)) {
    return (
      <div className="space-y-4">
        <p className="font-medium text-on-surface">{row.displayName}</p>
        <Link href={`/admin/artists/${row.id}/edit`} className="text-sm text-link underline">
          Review artist
        </Link>
      </div>
    );
  }

  if (tab === "kyc" && isKycRow(row)) {
    return (
      <div className="space-y-4">
        <div>
          <p className="font-medium text-on-surface">{kycUserLabel(row)}</p>
          <p className="mt-1 text-sm text-on-surface-variant">{row.provider}</p>
          <div className="mt-2">
            <AdminStatusBadge domain="kyc" status={row.status} />
          </div>
          <div className="mt-3">
            <OnboardingIssueAgeCell iso={row.createdAt} />
          </div>
          <p className="mt-2 text-xs text-on-surface-variant">{formatDateTime(row.createdAt)}</p>
        </div>
        <Link
          href={`/admin/clients/${encodeURIComponent(row.userId)}`}
          className="text-sm text-link underline"
        >
          Open client
        </Link>
      </div>
    );
  }

  if (tab === "orgs" && isStaleLeadRow(row, tab)) {
    return (
      <div className="space-y-4">
        <div>
          <p className="font-medium text-on-surface">{row.displayName}</p>
          <div className="mt-2">
            <OnboardingIssueAgeCell iso={row.createdAt} />
          </div>
          <p className="mt-1 text-sm text-on-surface-variant">
            Created {new Date(row.createdAt).toLocaleDateString("en-GB")}
          </p>
        </div>
        <Link href={`/admin/legal-entities/${row.id}`} className="text-sm text-link underline">
          Open entity
        </Link>
      </div>
    );
  }

  if (tab === "documents" && isDocumentRow(row)) {
    return (
      <div className="space-y-4">
        <div>
          <p className="font-medium text-on-surface">{row.entityDisplayName}</p>
          <p className="mt-1 text-sm text-on-surface-variant">Document awaiting review</p>
          <div className="mt-2">
            <OnboardingIssueAgeCell iso={row.uploadedAt} />
          </div>
        </div>
        <Link
          href={`/admin/legal-entities/${row.legalEntityId}?tab=documents`}
          className="text-sm text-link underline"
        >
          Review documents
        </Link>
      </div>
    );
  }

  return null;
}
