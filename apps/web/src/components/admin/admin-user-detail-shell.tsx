"use client";

import { AdminEntityDetailShell } from "@/components/admin/admin-entity-detail-shell";
import {
  UserRoleAction,
  UserStaffRoleAction,
  UserSuspendAction,
} from "@/components/admin/admin-user-actions";
import { AdminUserAvatar } from "@/components/admin/admin-user-avatar";
import { AdminUserQuickActions } from "@/components/admin/admin-user-quick-actions";
import {
  type AdminUserSummaryMetrics,
  AdminUserSummaryStrip,
} from "@/components/admin/admin-user-summary-strip";
import { formatAdminUserDate } from "@/lib/admin/format-admin-user-date";
import { staffRoleLabel } from "@/lib/admin/staff-role-presenter";
import type { AdminUserDetailPayload } from "@/lib/data/http/admin.server";
import type { UserRole, UserStaffRole } from "@auction/types";
import { StatusBadge } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@auction/ui/components/tabs";
import Link from "next/link";
import type { ReactNode } from "react";

function daysSince(iso: string): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "";
  const days = Math.floor((Date.now() - t) / (24 * 60 * 60 * 1000));
  if (days < 1) return "today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

type TabDef = {
  id: string;
  label: string;
  content: ReactNode;
};

type Props = {
  user: AdminUserDetailPayload;
  listHref: string;
  listLabel: string;
  tabs: TabDef[];
  summaryMetrics?: AdminUserSummaryMetrics;
  legalEntitiesForActions?: { id: string; displayName: string }[];
};

export function AdminUserDetailShell({
  user,
  listHref,
  listLabel,
  tabs,
  summaryMetrics,
  legalEntitiesForActions = [],
}: Props) {
  const isStaff = user.role === "staff";

  return (
    <AdminEntityDetailShell
      breadcrumbs={
        <Link
          href={listHref}
          className="inline-flex min-h-11 items-center font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-primary hover:underline"
        >
          ← {listLabel}
        </Link>
      }
      title={user.name}
      meta={
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <AdminUserAvatar user={user} size="lg" />
            <p className="font-body text-sm text-on-surface-variant">{user.email}</p>
          </div>
          {summaryMetrics ? <AdminUserSummaryStrip metrics={summaryMetrics} /> : null}
          {!isStaff ? (
            <AdminUserQuickActions
              userId={user.id}
              email={user.email}
              legalEntities={legalEntitiesForActions}
            />
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge variant={isStaff ? "info" : "neutral"}>
              {isStaff ? "Staff" : "Client"}
            </StatusBadge>
            {isStaff ? (
              <StatusBadge variant="neutral">
                {staffRoleLabel(user.staffRole as UserStaffRole | null)}
              </StatusBadge>
            ) : null}
            <StatusBadge variant={user.suspendedAt ? "danger" : "success"}>
              {user.suspendedAt ? "Suspended" : "Active"}
            </StatusBadge>
            <span className="font-body text-xs text-on-surface-variant">
              Created {formatAdminUserDate(user.createdAt)} ({daysSince(user.createdAt)})
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="font-mono text-xs"
              onClick={() => void navigator.clipboard.writeText(user.id)}
            >
              Copy user ID
            </Button>
          </div>
          <p className="font-mono text-xs text-on-surface-variant">{user.id}</p>
        </div>
      }
    >
      <div className="grid gap-8 lg:grid-cols-[1fr_minmax(16rem,20rem)]">
        <Tabs defaultValue={tabs[0]?.id ?? "profile"} className="w-full min-w-0">
          <TabsList className="flex h-auto min-h-11 flex-wrap justify-start gap-1 bg-surface-container-low p-1">
            {tabs.map((tab) => (
              <TabsTrigger
                key={tab.id}
                value={tab.id}
                className="font-label text-[11px] uppercase tracking-wide"
              >
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
          {tabs.map((tab) => (
            <TabsContent
              key={tab.id}
              value={tab.id}
              className="mt-6 rounded-xl border border-border-hairline bg-surface-container-low/40 p-6"
            >
              {tab.content}
            </TabsContent>
          ))}
        </Tabs>

        <aside className="space-y-6 rounded-xl border border-border-hairline bg-surface-container-low/60 p-5 lg:sticky lg:top-24 lg:self-start">
          <p className="font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
            Account controls
          </p>
          <div className="space-y-4">
            <UserRoleAction userId={user.id} defaultRole={user.role as UserRole} layout="block" />
          </div>
          {isStaff ? (
            <div className="space-y-4 border-t border-border-hairline pt-4">
              <p className="font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
                Internal staff role
              </p>
              <UserStaffRoleAction
                userId={user.id}
                defaultStaffRole={(user.staffRole as UserStaffRole | null) ?? null}
              />
            </div>
          ) : null}
          <div className="border-t border-border-hairline pt-4">
            <UserSuspendAction userId={user.id} suspendedAt={user.suspendedAt} fullWidthButton />
          </div>
        </aside>
      </div>
    </AdminEntityDetailShell>
  );
}
