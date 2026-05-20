"use client";

import { AdminDataTable } from "@/components/admin/admin-data-table";
import { AdminEmptyState } from "@/components/admin/admin-empty-state";
import { AdminDetailTabs } from "@/components/dashboard/primitives/admin-detail-tabs";
import { useTableDensity } from "@/components/layout/density-provider";
import type { AdminOnboardingIssuesPayload } from "@/lib/data/http/admin.server";
import { formatDateTime } from "@/lib/ui/format";
import { Badge } from "@auction/ui/components/badge";
import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
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
}: {
  rows: T[];
  columns: ColumnDef<T>[];
  emptyTitle: string;
}) {
  const { density } = useTableDensity();
  if (rows.length === 0) {
    return <AdminEmptyState title="Clear" description={emptyTitle} />;
  }
  return (
    <AdminDataTable
      ariaLabel={emptyTitle}
      columns={columns}
      data={rows}
      density={density}
      getRowId={(r) => r.id}
    />
  );
}

export function OnboardingIssuesBoard({ data }: { data: AdminOnboardingIssuesPayload }) {
  const entityColumns = useMemo(
    (): ColumnDef<AdminOnboardingIssuesPayload["entitiesPendingReview"][number]>[] => [
      { accessorKey: "displayName", header: "Entity" },
      { accessorKey: "status", header: "Status" },
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

  const identityColumns = useMemo(
    (): ColumnDef<AdminOnboardingIssuesPayload["staleIdentitySessions"][number]>[] => [
      {
        accessorKey: "userId",
        header: "User",
        cell: ({ row }) => <span className="font-mono text-xs">{row.original.userId}</span>,
      },
      { accessorKey: "status", header: "Status" },
      {
        accessorKey: "createdAt",
        header: "Created",
        cell: ({ row }) => formatDateTime(row.original.createdAt),
      },
      linkColumn(
        (r) => `/admin/clients/${encodeURIComponent(r.userId)}`,
        () => "User",
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
        cell: ({ row }) => <span className="font-mono text-xs">{row.original.uploadObjectId}</span>,
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
        ? { badge: <Badge variant="secondary">{data.entitiesPendingReview.length}</Badge> }
        : {}),
      content: (
        <IssuesTable
          rows={data.entitiesPendingReview}
          columns={entityColumns}
          emptyTitle="No entities in review."
        />
      ),
    },
    {
      value: "artists",
      label: "Artists",
      ...(data.artistsPendingApproval.length > 0
        ? { badge: <Badge variant="secondary">{data.artistsPendingApproval.length}</Badge> }
        : {}),
      content: (
        <IssuesTable
          rows={data.artistsPendingApproval}
          columns={artistColumns}
          emptyTitle="No pending artists."
        />
      ),
    },
    {
      value: "identity",
      label: "Identity",
      ...(data.staleIdentitySessions.length > 0
        ? { badge: <Badge variant="secondary">{data.staleIdentitySessions.length}</Badge> }
        : {}),
      content: (
        <IssuesTable
          rows={data.staleIdentitySessions}
          columns={identityColumns}
          emptyTitle="No stale verification sessions."
        />
      ),
    },
    {
      value: "orgs",
      label: "Lead orgs",
      ...(data.staleLeadOrganisations.length > 0
        ? { badge: <Badge variant="secondary">{data.staleLeadOrganisations.length}</Badge> }
        : {}),
      content: (
        <IssuesTable
          rows={data.staleLeadOrganisations}
          columns={orgColumns}
          emptyTitle="No stale lead organisations."
        />
      ),
    },
    {
      value: "documents",
      label: "Documents",
      ...(data.documentsAwaitingReview.length > 0
        ? { badge: <Badge variant="secondary">{data.documentsAwaitingReview.length}</Badge> }
        : {}),
      content: (
        <IssuesTable
          rows={data.documentsAwaitingReview}
          columns={docColumns}
          emptyTitle="No pending entity documents."
        />
      ),
    },
  ] as const;

  return <AdminDetailTabs defaultValue="entities" tabs={tabs} />;
}
