"use client";

import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import { AdminUserAvatar } from "@/components/admin/admin-user-avatar";
import type { AdminUserRow } from "@/lib/data/http/admin.server";
import { Button } from "@auction/ui/components/button";
import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

type Props = {
  title: string;
  subtitle?: string;
  onOpen: () => void;
  avatar?: ReactNode;
  badges?: ReactNode;
  meta?: ReactNode;
};

/** Shared mobile list card for staff and client directories. */
export function PeopleMobileCard({ title, subtitle, onOpen, avatar, badges, meta }: Props) {
  return (
    <Button
      type="button"
      variant="outline"
      className="flex h-auto min-h-0 w-full items-center gap-3 rounded-sm border border-border-hairline bg-surface-container-lowest/80 p-4 text-left shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      onClick={onOpen}
      aria-label={`Open ${title}`}
    >
      {avatar}
      <div className="min-w-0 flex-1">
        <p className="truncate font-headline text-base text-on-surface">{title}</p>
        {subtitle ? <p className="truncate text-xs text-on-surface-variant">{subtitle}</p> : null}
        {badges ? <div className="mt-1 flex flex-wrap items-center gap-1.5">{badges}</div> : null}
        {meta ? <div className="mt-1 text-[10px] text-on-surface-variant">{meta}</div> : null}
      </div>
      <ChevronRight className="size-4 shrink-0 text-on-surface-variant" aria-hidden />
    </Button>
  );
}

type ClientCardProps = {
  user: AdminUserRow;
  onOpen: () => void;
  formatPersona: (persona: string | null) => string;
  formatJoined: (iso: string) => string;
};

export function PeopleClientMobileCard({
  user,
  onOpen,
  formatPersona,
  formatJoined,
}: ClientCardProps) {
  return (
    <PeopleMobileCard
      title={user.name}
      subtitle={user.email}
      onOpen={onOpen}
      avatar={<AdminUserAvatar user={user} />}
      badges={
        <>
          <AdminStatusBadge
            domain="user"
            status={user.suspendedAt ? "suspended" : "active"}
            size="sm"
          />
          {user.emailVerified ? (
            <span className="text-[10px] text-success">Email verified</span>
          ) : (
            <span className="text-[10px] text-on-surface-variant">Email unverified</span>
          )}
          <AdminStatusBadge domain="kyc" status={user.kycStatus ?? ""} size="sm" />
        </>
      }
      meta={
        <>
          {formatPersona(user.signupPersona)} · Joined {formatJoined(user.createdAt)}
        </>
      }
    />
  );
}

type StaffCardProps = {
  user: AdminUserRow;
  onOpen: () => void;
  roleLabel: string;
};

export function PeopleStaffMobileCard({ user, onOpen, roleLabel }: StaffCardProps) {
  return (
    <PeopleMobileCard
      title={user.name}
      subtitle={user.email}
      onOpen={onOpen}
      badges={
        <>
          <span className="font-label text-[10px] uppercase text-secondary">{roleLabel}</span>
          <AdminStatusBadge
            domain="user"
            status={user.suspendedAt ? "suspended" : "active"}
            size="sm"
          />
        </>
      }
    />
  );
}
