import { AdminCopyField } from "@/components/admin/admin-copy-field";
import { AdminUserAvatar } from "@/components/admin/admin-user-avatar";
import { formatAdminUserDate } from "@/lib/admin/format-admin-user-date";
import { kycStatusBadgeVariant, kycStatusLabel } from "@/lib/admin/kyc-status-presenter";
import { relativeFromIso } from "@/lib/admin/relative-time";
import { staffRoleLabel } from "@/lib/admin/staff-role-presenter";
import type { AdminUserDetailPayload } from "@/lib/data/http/admin.server";
import type { UserStaffRole } from "@auction/types";
import { StatusBadge } from "@auction/ui";
import { Surface } from "@auction/ui/components/surface";
import type { ReactNode } from "react";

function ProfileSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <Surface variant="quiet" padding="md" className="space-y-3">
      <h3 className="font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
        {title}
      </h3>
      {children}
    </Surface>
  );
}

export function AdminUserProfilePanel({ user }: { user: AdminUserDetailPayload }) {
  const isStaff = user.role === "staff";

  return (
    <div className="space-y-4">
      <ProfileSection title="Identity">
        <div className="flex items-center gap-3">
          <AdminUserAvatar user={user} size="lg" />
          <div>
            <p className="font-headline text-lg">{user.name}</p>
            <p className="text-sm text-on-surface-variant">{user.email}</p>
          </div>
        </div>
        <dl className="mt-4 grid gap-3 text-sm md:grid-cols-2">
          <div>
            <dt className="font-label text-[10px] uppercase text-on-surface-variant">User ID</dt>
            <dd className="mt-1">
              <AdminCopyField value={user.id} label="User ID" />
            </dd>
          </div>
          {user.image ? (
            <div className="md:col-span-2">
              <dt className="font-label text-[10px] uppercase text-on-surface-variant">
                Avatar URL
              </dt>
              <dd className="break-all text-xs">{user.image}</dd>
            </div>
          ) : null}
        </dl>
      </ProfileSection>

      <ProfileSection title="Account">
        <dl className="grid gap-3 text-sm md:grid-cols-2">
          <div>
            <dt className="font-label text-[10px] uppercase text-on-surface-variant">Role</dt>
            <dd className="capitalize">{user.role}</dd>
          </div>
          {isStaff ? (
            <div>
              <dt className="font-label text-[10px] uppercase text-on-surface-variant">
                Staff role
              </dt>
              <dd>{staffRoleLabel(user.staffRole as UserStaffRole | null)}</dd>
            </div>
          ) : null}
          <div>
            <dt className="font-label text-[10px] uppercase text-on-surface-variant">Created</dt>
            <dd>{formatAdminUserDate(user.createdAt)}</dd>
          </div>
          <div>
            <dt className="font-label text-[10px] uppercase text-on-surface-variant">Last seen</dt>
            <dd>{relativeFromIso(user.updatedAt)}</dd>
          </div>
          <div>
            <dt className="font-label text-[10px] uppercase text-on-surface-variant">Status</dt>
            <dd>
              {user.suspendedAt ? `Suspended · ${formatAdminUserDate(user.suspendedAt)}` : "Active"}
            </dd>
          </div>
          {user.suspendedReason ? (
            <div className="md:col-span-2">
              <dt className="font-label text-[10px] uppercase text-on-surface-variant">
                Suspension reason
              </dt>
              <dd className="text-error">{user.suspendedReason}</dd>
            </div>
          ) : null}
        </dl>
      </ProfileSection>

      <ProfileSection title="Verification">
        <dl className="grid gap-3 text-sm md:grid-cols-2">
          <div>
            <dt className="font-label text-[10px] uppercase text-on-surface-variant">Email</dt>
            <dd className="flex items-center gap-2">
              {user.emailVerified ? (
                <StatusBadge variant="success" size="sm">
                  Verified
                </StatusBadge>
              ) : (
                <StatusBadge variant="warning" size="sm">
                  Unverified
                </StatusBadge>
              )}
            </dd>
          </div>
          <div>
            <dt className="font-label text-[10px] uppercase text-on-surface-variant">KYC</dt>
            <dd>
              <StatusBadge variant={kycStatusBadgeVariant(user.kycStatus)} size="sm">
                {kycStatusLabel(user.kycStatus)}
              </StatusBadge>
            </dd>
          </div>
          {user.kycVerifiedAt ? (
            <div>
              <dt className="font-label text-[10px] uppercase text-on-surface-variant">
                KYC verified
              </dt>
              <dd>{formatAdminUserDate(user.kycVerifiedAt)}</dd>
            </div>
          ) : null}
        </dl>
      </ProfileSection>
    </div>
  );
}
