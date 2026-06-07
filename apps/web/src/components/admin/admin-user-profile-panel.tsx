import { AdminCopyField } from "@/components/admin/admin-copy-field";
import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import { AdminUserAvatar } from "@/components/admin/admin-user-avatar";
import { formatAdminUserDate } from "@/lib/admin/format-admin-user-date";
import { relativeFromIso } from "@/lib/admin/relative-time";
import { staffRoleLabel } from "@/lib/admin/staff-role-presenter";
import { formatAmlHoldReason } from "@/lib/admin/status-badge-variants";
import type { AdminUserDetailPayload } from "@/lib/data/http/admin.server";
import type { UserStaffRole } from "@auction/types";
import { Surface } from "@auction/ui/components/surface";
import { formatPhoneDisplay } from "@auction/validators";
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
  const mobileDisplay = formatPhoneDisplay(user.mobile);

  return (
    <div className="space-y-4">
      <ProfileSection title="Identity">
        <div className="flex items-center gap-3">
          <AdminUserAvatar user={user} size="lg" />
          <div>
            <p className="font-headline text-lg">{user.name}</p>
            {(user.firstName || user.lastName) && (
              <p className="text-sm text-on-surface-variant">
                {[user.firstName, user.lastName].filter(Boolean).join(" ")}
              </p>
            )}
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
          {mobileDisplay ? (
            <div>
              <dt className="font-label text-[10px] uppercase text-on-surface-variant">Mobile</dt>
              <dd>
                {mobileDisplay}
                {user.mobileCountry ? (
                  <span className="text-on-surface-variant"> ({user.mobileCountry})</span>
                ) : null}
              </dd>
            </div>
          ) : null}
          {user.dateOfBirth ? (
            <div>
              <dt className="font-label text-[10px] uppercase text-on-surface-variant">
                Date of birth
              </dt>
              <dd>{user.dateOfBirth}</dd>
            </div>
          ) : null}
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
            <dt className="font-label text-[10px] uppercase text-on-surface-variant">Persona</dt>
            <dd className="capitalize">{user.signupPersona ?? "Not set"}</dd>
          </div>
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
          {user.deletionRequestedAt ? (
            <div className="md:col-span-2">
              <dt className="font-label text-[10px] uppercase text-on-surface-variant">
                Deletion requested
              </dt>
              <dd className="text-warning">{formatAdminUserDate(user.deletionRequestedAt)}</dd>
            </div>
          ) : null}
        </dl>
      </ProfileSection>

      <ProfileSection title="Verification">
        <dl className="grid gap-3 text-sm md:grid-cols-2">
          <div>
            <dt className="font-label text-[10px] uppercase text-on-surface-variant">Email</dt>
            <dd className="flex items-center gap-2">
              <AdminStatusBadge
                domain="kyc"
                status={user.emailVerified ? "approved" : "pending"}
                label={user.emailVerified ? "Verified" : "Unverified"}
                size="sm"
              />
            </dd>
          </div>
          <div>
            <dt className="font-label text-[10px] uppercase text-on-surface-variant">
              Email deliverability
            </dt>
            <dd className="capitalize">{user.emailStatus}</dd>
          </div>
          {user.emailStatusChangedAt ? (
            <div>
              <dt className="font-label text-[10px] uppercase text-on-surface-variant">
                Email status changed
              </dt>
              <dd>{formatAdminUserDate(user.emailStatusChangedAt)}</dd>
            </div>
          ) : null}
          {user.pendingNewEmail ? (
            <div className="md:col-span-2">
              <dt className="font-label text-[10px] uppercase text-on-surface-variant">
                Pending email change
              </dt>
              <dd className="break-all">{user.pendingNewEmail}</dd>
              {user.emailChangeExpiresAt ? (
                <p className="text-xs text-on-surface-variant">
                  Expires {formatAdminUserDate(user.emailChangeExpiresAt)}
                </p>
              ) : null}
            </div>
          ) : null}
          <div>
            <dt className="font-label text-[10px] uppercase text-on-surface-variant">KYC</dt>
            <dd>
              <AdminStatusBadge domain="kyc" status={user.kycStatus ?? ""} size="sm" />
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
          <div>
            <dt className="font-label text-[10px] uppercase text-on-surface-variant">
              KYC retries
            </dt>
            <dd>{user.kycRetryCount}</dd>
          </div>
          {user.currentKycSessionId ? (
            <div className="md:col-span-2">
              <dt className="font-label text-[10px] uppercase text-on-surface-variant">
                Current KYC session
              </dt>
              <dd className="break-all font-mono text-xs">{user.currentKycSessionId}</dd>
            </div>
          ) : null}
          {user.amlHoldStatus && user.amlHoldStatus !== "none" ? (
            <div className="md:col-span-2">
              <dt className="font-label text-[10px] uppercase text-on-surface-variant">AML hold</dt>
              <dd className="flex flex-wrap items-center gap-2">
                <AdminStatusBadge domain="amlHold" status={user.amlHoldStatus} size="sm" />
                {formatAmlHoldReason(user.amlHoldReason) ? (
                  <span className="text-sm text-on-surface-variant">
                    {formatAmlHoldReason(user.amlHoldReason)}
                  </span>
                ) : null}
                {user.amlHoldAt ? (
                  <span className="text-xs text-on-surface-variant">
                    since {formatAdminUserDate(user.amlHoldAt)}
                  </span>
                ) : null}
              </dd>
            </div>
          ) : null}
        </dl>
      </ProfileSection>

      <ProfileSection title="Security">
        <dl className="grid gap-3 text-sm md:grid-cols-2">
          <div>
            <dt className="font-label text-[10px] uppercase text-on-surface-variant">
              Two-factor authentication
            </dt>
            <dd>
              <AdminStatusBadge
                domain="kyc"
                status={user.twoFactorEnabled ? "approved" : "unverified"}
                label={user.twoFactorEnabled ? "Enabled" : "Disabled"}
                size="sm"
              />
            </dd>
          </div>
        </dl>
      </ProfileSection>
    </div>
  );
}
