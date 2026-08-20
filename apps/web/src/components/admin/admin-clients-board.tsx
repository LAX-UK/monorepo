"use client";

import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import { AdminTechnicalIdDisclosure } from "@/components/admin/admin-technical-id-disclosure";
import { UserSuspendAction } from "@/components/admin/admin-user-actions";
import { AdminUserAvatar } from "@/components/admin/admin-user-avatar";
import { AdminUserListShell } from "@/components/admin/admin-user-list-shell";
import { PeopleClientMobileCard } from "@/components/admin/people/people-mobile-card";
import { SignupPersonaBadge } from "@/components/admin/signup-persona-badge";
import {
  userJoinedColumn,
  userKycVerifiedAtColumn,
  userPersonaColumn,
  userRowActionsColumn,
  userStatusColumn,
} from "@/components/admin/users-board";
import { FilterEmptyState } from "@/components/app/filter-empty-state";
import { getUserBulkOperations } from "@/lib/admin/bulk-ops/users";
import { copyTextToClipboard } from "@/lib/admin/copy-text";
import { formatAdminUserDate } from "@/lib/admin/format-admin-user-date";
import { buildPeopleDetailHref } from "@/lib/admin/people/people-detail-href";
import type { AdminUserRow } from "@/lib/data/http/admin.server";
import { Button } from "@auction/ui/components/button";
import { formatPhoneDisplay } from "@auction/validators";
import type { ColumnDef } from "@tanstack/react-table";
import { Check } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { useCallback, useMemo, useState } from "react";

type CopyStatus = "idle" | "copying" | "copied" | "unavailable";

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
    userKycVerifiedAtColumn(),
    userJoinedColumn(),
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
          className="block h-auto max-w-[14rem] truncate px-0 py-0 text-left text-sm font-medium text-link underline-offset-2 hover:underline"
          onClick={onOpen}
        >
          {u.name}
        </Button>
        <p className="max-w-[14rem] truncate text-xs text-on-surface-variant">{u.email}</p>
        <p className="mt-0.5 flex max-w-[14rem] flex-wrap items-center gap-1 truncate text-[10px] text-on-surface-variant">
          <SignupPersonaBadge persona={u.signupPersona} size="compact" />
          <span aria-hidden>·</span>
          <span>Joined {formatAdminUserDate(u.createdAt)}</span>
        </p>
      </div>
    </div>
  );
}

function ClientDrawerOverview({ u }: { u: AdminUserRow }) {
  const mobile = formatPhoneDisplay(u.mobile);

  return (
    <div className="space-y-4">
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
        <DetailItem label="Persona">
          <SignupPersonaBadge persona={u.signupPersona} />
        </DetailItem>
        <DetailItem label="Joined">{formatAdminUserDate(u.createdAt)}</DetailItem>
        {mobile ? (
          <DetailItem label="Mobile" className="sm:col-span-2">
            <span title={u.mobile ?? undefined}>
              {mobile}
              {u.mobileCountry ? ` (${u.mobileCountry})` : ""}
            </span>
          </DetailItem>
        ) : null}
      </dl>
      <AdminTechnicalIdDisclosure items={[{ label: "User ID", value: u.id }]} />
    </div>
  );
}

function ClientDrawerActions({
  u,
  listReturnTarget,
}: {
  u: AdminUserRow;
  listReturnTarget?: string | undefined;
}) {
  return (
    <div className="space-y-4">
      <Button variant="secondary" className="w-full font-label uppercase" asChild>
        <Link href={buildPeopleDetailHref(`/admin/clients/${u.id}`, listReturnTarget)}>
          Open full profile
        </Link>
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
  externalMobileCards?: boolean;
  selected?: AdminUserRow | null;
  listReturnTarget?: string | undefined;
  onOpen?: (user: AdminUserRow) => void;
  onCloseDrawer?: () => void;
};

export function AdminClientsBoard({
  rows,
  totalMatches,
  hasActiveFilters,
  externalMobileCards = false,
  selected = null,
  listReturnTarget,
  onOpen,
  onCloseDrawer,
}: Props) {
  const bulkOperations = useMemo(() => getUserBulkOperations(), []);

  const renderDrawerOverview = useCallback((u: AdminUserRow) => <ClientDrawerOverview u={u} />, []);
  const renderDrawerActions = useCallback(
    (u: AdminUserRow) => <ClientDrawerActions u={u} listReturnTarget={listReturnTarget} />,
    [listReturnTarget],
  );

  const renderMobileCard = useCallback(
    (u: AdminUserRow, onOpen: () => void) => (
      <PeopleClientMobileCard user={u} onOpen={onOpen} formatJoined={formatAdminUserDate} />
    ),
    [],
  );

  return (
    <AdminUserListShell
      rows={rows}
      totalMatches={totalMatches}
      bulkOperations={bulkOperations}
      drawerTitle="Client"
      boardTitle="Clients"
      tableAriaLabel="Clients"
      emptyComponent={
        <FilterEmptyState
          entity="clients"
          segment="admin"
          hasActiveFilters={hasActiveFilters}
          clearFiltersHref="/admin/clients"
        />
      }
      renderDrawerOverview={renderDrawerOverview}
      renderDrawerActions={renderDrawerActions}
      {...(externalMobileCards ? { externalMobileCards: true } : { renderMobileCard })}
      buildColumns={clientColumns}
      detailHref={(u) => `/admin/clients/${u.id}`}
      showColumnPicker
      columnVisibilityStorageKey="admin.clients.columns"
      {...(onOpen
        ? {
            selected,
            onOpen,
            ...(onCloseDrawer ? { onCloseDrawer } : {}),
          }
        : {})}
    />
  );
}
