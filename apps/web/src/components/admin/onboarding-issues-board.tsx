"use client";

import { AdminDataTable } from "@/components/admin/admin-data-table";
import { AdminEmptyState } from "@/components/admin/admin-empty-state";
import { AdminQueueCountBadge, AdminStatusBadge } from "@/components/admin/admin-status-badge";
import { AdminDetailTabs } from "@/components/dashboard/primitives/admin-detail-tabs";
import { useTableDensity } from "@/components/layout/density-provider";
import type { AdminOnboardingIssuesPayload } from "@/lib/data/http/admin.server";
import { formatDateTime } from "@/lib/ui/format";
import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import type { ReactNode } from "react";
import { useMemo } from "react";

function linkColumn<T extends { id: string }>(
  href: (row: T) => string,
  label: (row: T) => string,
): ColumnDef<T> {
  return {
    id: "link",
    header: "",
    cell: ({ row }) => (
      <Link href={href(row.original)} className="text-sm font-medium text-primary underline">
        {label(row.original)}
      </Link>
    ),
    enableSorting: false,
  };
}

function IssuesTable<T extends { id: string }>({
  rows,
  columns,
  emptyTitle,
  renderCard,
}: {
  rows: T[];
  columns: ColumnDef<T>[];
  emptyTitle: string;
  renderCard?: (row: T) => ReactNode;
}) {
  const { density } = useTableDensity();
  if (rows.length === 0) {
    return <AdminEmptyState title={emptyTitle} description="Nothing in this queue right now." />;
  }

  const cards = renderCard ? (
    <ul className="space-y-2 lg:hidden">
      {rows.map((row) => (
        <li
          key={row.id}
          className="rounded-lg border border-border-hairline bg-surface-container-lowest/80 p-4"
        >
          {renderCard(row)}
        </li>
      ))}
    </ul>
  ) : null;

  return (
    <>
      <div className="hidden lg:block">
        <AdminDataTable
          ariaLabel={emptyTitle}
          columns={columns}
          data={rows}
          density={density}
          getRowId={(r) => r.id}
        />
      </div>
      {cards}
    </>
  );
}

function kycUserLabel(row: {
  userId: string;
  userName?: string | null;
  userEmail?: string | null;
}): string {
  if (row.userName && row.userEmail) return `${row.userName} · ${row.userEmail}`;
  if (row.userName) return row.userName;
  if (row.userEmail) return row.userEmail;
  return row.userId;
}

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

  const entityColumns = useMemo(
    (): ColumnDef<AdminOnboardingIssuesPayload["entitiesPendingReview"][number]>[] => [
      { accessorKey: "displayName", header: "Entity" },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => <AdminStatusBadge domain="legalEntity" status={row.original.status} />,
      },
      linkColumn(
        (r) => `/admin/legal-entities/${r.id}`,
        () => "Open",
      ),
    ],
    [],
  );

  const artistColumns = useMemo(
    (): ColumnDef<AdminOnboardingIssuesPayload["artistsPendingApproval"][number]>[] => [
      { accessorKey: "displayName", header: "Artist" },
      linkColumn(
        (r) => `/admin/artists/${r.id}/edit`,
        () => "Review",
      ),
    ],
    [],
  );

  const kycColumns = useMemo(
    (): ColumnDef<AdminOnboardingIssuesPayload["staleKycSessions"][number]>[] => [
      {
        id: "user",
        header: "Client",
        cell: ({ row }) => {
          const r = row.original;
          const label = kycUserLabel(r);
          return (
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-on-surface">{label}</p>
              {label !== r.userId ? (
                <p className="truncate text-xs text-on-surface-variant">Client record</p>
              ) : null}
            </div>
          );
        },
      },
      { accessorKey: "provider", header: "Provider" },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => <AdminStatusBadge domain="kyc" status={row.original.status} />,
      },
      {
        accessorKey: "createdAt",
        header: "Created",
        cell: ({ row }) => formatDateTime(row.original.createdAt),
      },
      linkColumn(
        (r) => `/admin/clients/${encodeURIComponent(r.userId)}`,
        () => "Open client",
      ),
    ],
    [],
  );

  const orgColumns = useMemo(
    (): ColumnDef<AdminOnboardingIssuesPayload["staleLeadOrganisations"][number]>[] => [
      { accessorKey: "displayName", header: "Organisation" },
      {
        accessorKey: "createdAt",
        header: "Created",
        cell: ({ row }) => new Date(row.original.createdAt).toLocaleDateString("en-GB"),
      },
      linkColumn(
        (r) => `/admin/legal-entities/${r.id}`,
        () => "Open entity",
      ),
    ],
    [],
  );

  const docColumns = useMemo(
    (): ColumnDef<AdminOnboardingIssuesPayload["documentsAwaitingReview"][number]>[] => [
      { accessorKey: "entityDisplayName", header: "Entity" },
      {
        accessorKey: "uploadObjectId",
        header: "Upload",
        cell: () => <span className="text-xs text-on-surface-variant">Document upload</span>,
      },
      linkColumn(
        (r) => `/admin/legal-entities/${r.legalEntityId}`,
        () => "Entity",
      ),
    ],
    [],
  );

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
        <IssuesTable
          rows={data.entitiesPendingReview}
          columns={entityColumns}
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
        <IssuesTable
          rows={data.artistsPendingApproval}
          columns={artistColumns}
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
        <IssuesTable
          rows={data.staleKycSessions}
          columns={kycColumns}
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
        <IssuesTable
          rows={data.staleLeadOrganisations}
          columns={orgColumns}
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
        <IssuesTable
          rows={data.documentsAwaitingReview}
          columns={docColumns}
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
