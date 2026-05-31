"use client";

import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import { UserSuspendAction } from "@/components/admin/admin-user-actions";
import { AdminUserAvatar } from "@/components/admin/admin-user-avatar";
import { AdminUserListShell } from "@/components/admin/admin-user-list-shell";
import {
  userJoinedColumn,
  userKycVerifiedAtColumn,
  userLastActivityColumn,
  userPersonaColumn,
  userRowActionsColumn,
  userStatusColumn,
  userTwoFactorColumn,
} from "@/components/admin/users-board";
import { FilterEmptyState } from "@/components/app/filter-empty-state";
import { getUserBulkOperations } from "@/lib/admin/bulk-ops/users";
import { copyTextToClipboard } from "@/lib/admin/copy-text";
import { formatAdminUserDate } from "@/lib/admin/format-admin-user-date";
import { relativeFromIso } from "@/lib/admin/relative-time";
import type { AdminUserRow } from "@/lib/data/http/admin.server";
import { Button } from "@auction/ui/components/button";
import { formatPhoneDisplay } from "@auction/validators";
import type { ColumnDef } from "@tanstack/react-table";
import { Check, ChevronRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { useCallback, useMemo, useState } from "react";

type CopyStatus = "idle" | "copying" | "copied" | "unavailable";

function formatPersona(persona: string | null): string {
  if (!persona) return "Not set";
  if (persona === "organisation") return "Organisation";
  return persona.charAt(0).toUpperCase() + persona.slice(1);
}

function VerificationSummary({ u }: { u: AdminUserRow }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {u.emailVerified ? (
        <span
          className="inline-flex items-center gap-0.5 text-[10px] text-success"
          title="Email verified"
        >
          <Check className="size-3" aria-hidden />
          Email verified
        </span>
      ) : (
        <span className="text-[10px] text-on-surface-variant">Email unverified</span>
      )}
      <AdminStatusBadge domain="kyc" status={u.kycStatus ?? ""} size="sm" />
    </div>
  );
}

function DetailItem({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <dt className="font-label text-[10px] uppercase text-on-surface-variant">{label}</dt>
      <dd className="mt-1 text-sm text-on-surface">{children}</dd>
    </div>
  );
}

function CopyButton({
  value,
  label,
  copiedLabel,
}: {
  value: string;
  label: string;
  copiedLabel: string;
}) {
  const [status, setStatus] = useState<CopyStatus>("idle");
  const handleCopy = useCallback(async () => {
    setStatus("copying");
    const ok = await copyTextToClipboard(value);
    setStatus(ok ? "copied" : "unavailable");
  }, [value]);

  const buttonLabel =
    status === "copied" ? copiedLabel : status === "unavailable" ? "Copy unavailable" : label;

  return (
    <Button
      type="button"
      variant="outline"
      className="w-full"
      onClick={() => void handleCopy()}
      disabled={status === "copying"}
      aria-live="polite"
    >
      {buttonLabel}
    </Button>
  );
}

function clientColumns(onOpen: (u: AdminUserRow) => void): ColumnDef<AdminUserRow>[] {
  return [
    {
      id: "identity",
      header: "Client",
      cell: ({ row }) => {
        const u = row.original;
        return <ClientIdentityCell u={u} onOpen={() => onOpen(u)} />;
      },
    },
    {
      id: "verification",
      header: "Verification",
      cell: ({ row }) => {
        return <VerificationSummary u={row.original} />;
      },
    },
    userStatusColumn(),
    userPersonaColumn(),
    userTwoFactorColumn(),
    userKycVerifiedAtColumn(),
    userJoinedColumn(),
    userLastActivityColumn("Updated"),
    userRowActionsColumn(onOpen),
  ];
}

function ClientIdentityCell({ u, onOpen }: { u: AdminUserRow; onOpen: () => void }) {
  return (
    <div className="flex items-center gap-3">
      <AdminUserAvatar user={u} size="sm" />
      <div className="min-w-0">
        <Button
          type="button"
          variant="link"
          className="block h-auto max-w-[14rem] truncate px-0 py-0 text-left text-sm font-medium text-primary underline-offset-2 hover:underline"
          onClick={onOpen}
        >
          {u.name}
        </Button>
        <p className="max-w-[14rem] truncate text-xs text-on-surface-variant">{u.email}</p>
        <p className="mt-0.5 max-w-[14rem] truncate text-[10px] text-on-surface-variant">
          {formatPersona(u.signupPersona)} - Joined {formatAdminUserDate(u.createdAt)}
        </p>
      </div>
    </div>
  );
}

export function AdminClientMobileCard({ u, onOpen }: { u: AdminUserRow; onOpen: () => void }) {
  return (
    <Button
      type="button"
      variant="outline"
      className="flex h-auto min-h-0 w-full items-center gap-3 rounded-sm border border-border-hairline bg-surface-container-lowest/80 p-4 text-left shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      onClick={onOpen}
    >
      <AdminUserAvatar user={u} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-headline text-base text-on-surface">{u.name}</p>
        <p className="truncate text-xs text-on-surface-variant">{u.email}</p>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <AdminStatusBadge
            domain="user"
            status={u.suspendedAt ? "suspended" : "active"}
            size="sm"
          />
          {u.emailVerified ? (
            <span className="text-[10px] text-success">Email verified</span>
          ) : (
            <span className="text-[10px] text-on-surface-variant">Email unverified</span>
          )}
          <AdminStatusBadge domain="kyc" status={u.kycStatus ?? ""} size="sm" />
          <span className="text-[10px] text-on-surface-variant">
            {formatPersona(u.signupPersona)}
          </span>
          <span className="text-[10px] text-on-surface-variant">
            Joined {formatAdminUserDate(u.createdAt)}
          </span>
        </div>
      </div>
      <ChevronRight className="size-4 shrink-0 text-on-surface-variant" aria-hidden />
    </Button>
  );
}

function ClientDrawerOverview({ u }: { u: AdminUserRow }) {
  const mobile = formatPhoneDisplay(u.mobile);

  return (
    <dl className="grid grid-cols-1 gap-4 rounded-md border border-border-hairline bg-surface-container-lowest p-4 sm:grid-cols-2">
      <DetailItem label="Email" className="sm:col-span-2">
        <span className="break-all">{u.email}</span>
      </DetailItem>
      <DetailItem label="Email status">
        <span className={u.emailVerified ? "text-success" : "text-on-surface-variant"}>
          {u.emailVerified ? "Verified" : "Unverified"}
        </span>
      </DetailItem>
      <DetailItem label="KYC">
        <AdminStatusBadge domain="kyc" status={u.kycStatus ?? ""} size="sm" />
      </DetailItem>
      <DetailItem label="Persona">{formatPersona(u.signupPersona)}</DetailItem>
      <DetailItem label="2FA">
        <AdminStatusBadge
          domain="kyc"
          status={u.twoFactorEnabled ? "approved" : "unverified"}
          label={u.twoFactorEnabled ? "On" : "Off"}
          size="sm"
        />
      </DetailItem>
      <DetailItem label="Joined">{formatAdminUserDate(u.createdAt)}</DetailItem>
      <DetailItem label="Updated">{relativeFromIso(u.updatedAt)}</DetailItem>
      {mobile ? (
        <DetailItem label="Mobile" className="sm:col-span-2">
          <span title={u.mobile ?? undefined}>
            {mobile}
            {u.mobileCountry ? ` (${u.mobileCountry})` : ""}
          </span>
        </DetailItem>
      ) : null}
      <DetailItem label="User ID" className="sm:col-span-2">
        <span className="break-all font-mono text-xs">{u.id}</span>
      </DetailItem>
    </dl>
  );
}

function ClientDrawerActions({ u }: { u: AdminUserRow }) {
  return (
    <div className="space-y-4">
      <Button variant="secondary" className="w-full font-label uppercase" asChild>
        <Link href={`/admin/clients/${u.id}`}>Open full profile</Link>
      </Button>
      <CopyButton value={u.id} label="Copy user ID" copiedLabel="Copied user ID" />
      <CopyButton value={u.email} label="Copy email" copiedLabel="Copied email" />
      <UserSuspendAction userId={u.id} suspendedAt={u.suspendedAt} fullWidthButton />
    </div>
  );
}

type Props = {
  rows: AdminUserRow[];
  totalMatches: number;
  hasActiveFilters: boolean;
};

export function AdminClientsBoard({ rows, totalMatches, hasActiveFilters }: Props) {
  const bulkOperations = useMemo(() => getUserBulkOperations(), []);

  const renderDrawerOverview = useCallback((u: AdminUserRow) => <ClientDrawerOverview u={u} />, []);
  const renderDrawerActions = useCallback((u: AdminUserRow) => <ClientDrawerActions u={u} />, []);

  const renderMobileCard = useCallback(
    (u: AdminUserRow, onOpen: () => void) => <AdminClientMobileCard u={u} onOpen={onOpen} />,
    [],
  );

  return (
    <AdminUserListShell
      rows={rows}
      totalMatches={totalMatches}
      bulkOperations={bulkOperations}
      drawerTitle="Client"
      tableAriaLabel="Clients"
      emptyComponent={
        <FilterEmptyState entity="clients" segment="admin" hasActiveFilters={hasActiveFilters} />
      }
      renderDrawerOverview={renderDrawerOverview}
      renderDrawerActions={renderDrawerActions}
      renderMobileCard={renderMobileCard}
      buildColumns={clientColumns}
      detailHref={(u) => `/admin/clients/${u.id}`}
      showColumnPicker
      columnVisibilityStorageKey="admin.clients.columns"
    />
  );
}
