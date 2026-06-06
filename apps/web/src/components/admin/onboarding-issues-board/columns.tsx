"use client";

import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import type { AdminOnboardingIssuesPayload } from "@/lib/data/http/admin.server";
import { formatDateTime } from "@/lib/ui/format";
import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";

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

export function kycUserLabel(row: {
  userId: string;
  userName?: string | null;
  userEmail?: string | null;
}): string {
  if (row.userName && row.userEmail) return `${row.userName} · ${row.userEmail}`;
  if (row.userName) return row.userName;
  if (row.userEmail) return row.userEmail;
  return "View client";
}

export function entityColumns(): ColumnDef<
  AdminOnboardingIssuesPayload["entitiesPendingReview"][number]
>[] {
  return [
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
  ];
}

export function artistColumns(): ColumnDef<
  AdminOnboardingIssuesPayload["artistsPendingApproval"][number]
>[] {
  return [
    { accessorKey: "displayName", header: "Artist" },
    linkColumn(
      (r) => `/admin/artists/${r.id}/edit`,
      () => "Review",
    ),
  ];
}

export function kycColumns(): ColumnDef<
  AdminOnboardingIssuesPayload["staleKycSessions"][number]
>[] {
  return [
    {
      id: "user",
      header: "Client",
      cell: ({ row }) => {
        const r = row.original;
        const label = kycUserLabel(r);
        return (
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-on-surface">{label}</p>
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
  ];
}

export function orgColumns(): ColumnDef<
  AdminOnboardingIssuesPayload["staleLeadOrganisations"][number]
>[] {
  return [
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
  ];
}

export function docColumns(): ColumnDef<
  AdminOnboardingIssuesPayload["documentsAwaitingReview"][number]
>[] {
  return [
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
  ];
}
