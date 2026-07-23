"use client";

import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import { AdminTableDateTimeCell } from "@/components/admin/admin-table-datetime-cell";
import { OnboardingIssueAgeCell } from "@/components/admin/onboarding-issues-board/onboarding-issue-age-cell";
import type {
  AdminOnboardingArtistRow,
  AdminOnboardingDocumentRow,
  AdminOnboardingKycSessionRow,
  AdminOnboardingLegalEntityRow,
  AdminOnboardingStaleLeadRow,
} from "@/lib/data/http/admin-onboarding-issues.shared";
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
      <Link href={href(row.original)} className="text-sm font-medium text-link underline">
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

export function entityColumns(): ColumnDef<AdminOnboardingLegalEntityRow>[] {
  return [
    { accessorKey: "displayName", header: "Entity" },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => <AdminStatusBadge domain="legalEntity" status={row.original.status} />,
    },
    {
      id: "age",
      header: "Age",
      cell: ({ row }) => <OnboardingIssueAgeCell iso={row.original.createdAt} />,
    },
    linkColumn(
      (r) => `/admin/legal-entities/${r.id}`,
      () => "Open",
    ),
  ];
}

export function artistColumns(): ColumnDef<AdminOnboardingArtistRow>[] {
  return [
    { accessorKey: "displayName", header: "Artist" },
    {
      id: "age",
      header: "Age",
      cell: ({ row }) => <OnboardingIssueAgeCell iso={row.original.createdAt} />,
    },
    linkColumn(
      (r) => `/admin/artists/${r.id}/edit`,
      () => "Review",
    ),
  ];
}

export function kycColumns(): ColumnDef<AdminOnboardingKycSessionRow>[] {
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
      id: "age",
      header: "Age",
      cell: ({ row }) => <OnboardingIssueAgeCell iso={row.original.createdAt} />,
    },
    {
      accessorKey: "createdAt",
      header: "Created",
      cell: ({ row }) => <AdminTableDateTimeCell iso={row.original.createdAt} mode="timestamp" />,
    },
    linkColumn(
      (r) => `/admin/clients/${encodeURIComponent(r.userId)}`,
      () => "Open client",
    ),
  ];
}

export function orgColumns(): ColumnDef<AdminOnboardingStaleLeadRow>[] {
  return [
    { accessorKey: "displayName", header: "Organisation" },
    {
      id: "age",
      header: "Age",
      cell: ({ row }) => <OnboardingIssueAgeCell iso={row.original.createdAt} />,
    },
    {
      accessorKey: "createdAt",
      header: "Created",
      cell: ({ row }) => <AdminTableDateTimeCell iso={row.original.createdAt} mode="dateOnly" />,
    },
    linkColumn(
      (r) => `/admin/legal-entities/${r.id}`,
      () => "Open entity",
    ),
  ];
}

export function docColumns(): ColumnDef<AdminOnboardingDocumentRow>[] {
  return [
    { accessorKey: "entityDisplayName", header: "Entity" },
    {
      id: "age",
      header: "Age",
      cell: ({ row }) => <OnboardingIssueAgeCell iso={row.original.uploadedAt} />,
    },
    {
      accessorKey: "uploadObjectId",
      header: "Upload",
      cell: () => <span className="text-xs text-on-surface-variant">Document upload</span>,
    },
    linkColumn(
      (r) => `/admin/legal-entities/${r.legalEntityId}?tab=documents`,
      () => "Review documents",
    ),
  ];
}
