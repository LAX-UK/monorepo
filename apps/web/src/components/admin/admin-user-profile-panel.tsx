import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import { AdminTechnicalIdDisclosure } from "@/components/admin/admin-technical-id-disclosure";
import { CatalogDetailTabCard } from "@/components/admin/catalog";
import { SignupPersonaBadge } from "@/components/admin/signup-persona-badge";
import { CollapsibleSection } from "@/components/ui/collapsible-section";
import { formatEmailDeliverabilityStatus, formatUserRole } from "@/lib/admin/admin-user-presenters";
import { formatAdminUserDate } from "@/lib/admin/format-admin-user-date";
import { relativeFromIso } from "@/lib/admin/relative-time";
import { staffRoleLabel } from "@/lib/admin/staff-role-presenter";
import { formatAmlHoldReason } from "@/lib/admin/status-badge-variants";
import type { AdminUserDetailPayload } from "@/lib/data/http/admin.server";
import type { UserStaffRole } from "@auction/types";
import { formatPhoneDisplay } from "@auction/validators";
import type { ReactNode } from "react";

function ProfileCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <CatalogDetailTabCard title={title} {...(description ? { description } : {})}>
      {children}
    </CatalogDetailTabCard>
  );
}

export function AdminUserProfilePanel({ user }: { user: AdminUserDetailPayload }) {
  const isStaff = user.role === "staff";
  const mobileDisplay = formatPhoneDisplay(user.mobile);

  const hasAdvancedDetails =
    Boolean(user.image) ||
    Boolean(user.currentKycSessionId) ||
    Boolean(user.emailStatusChangedAt) ||
    Boolean(user.pendingNewEmail);

  return (
    <div className="space-y-6">
      <ProfileCard title="Identity" description="Core profile information.">
        <dl className="grid gap-3 text-sm md:grid-cols-2">
          <div>
            <dt className="font-label text-[10px] uppercase text-on-surface-variant">Full name</dt>
            <dd>{user.name}</dd>
          </div>
          <div>
            <dt className="font-label text-[10px] uppercase text-on-surface-variant">Email</dt>
            <dd>{user.email}</dd>
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
        </dl>
      </ProfileCard>

      <ProfileCard title="Account" description="Platform role and membership.">
        <dl className="grid gap-3 text-sm md:grid-cols-2">
          <div>
            <dt className="font-label text-[10px] uppercase text-on-surface-variant">Role</dt>
            <dd>{formatUserRole(user.role)}</dd>
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
            <dd>
              <SignupPersonaBadge persona={user.signupPersona} />
            </dd>
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
      </ProfileCard>

      <ProfileCard title="Verification" description="Identity and contact verification status.">
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
            <dd>{formatEmailDeliverabilityStatus(user.emailStatus)}</dd>
          </div>
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
      </ProfileCard>

      <ProfileCard title="Security" description="Authentication and recovery settings.">
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
      </ProfileCard>

      {hasAdvancedDetails ? (
        <CollapsibleSection title="Advanced details">
          <dl className="grid gap-3 p-4 text-sm md:grid-cols-2">
            {user.image ? (
              <div className="md:col-span-2">
                <dt className="font-label text-[10px] uppercase text-on-surface-variant">
                  Avatar URL
                </dt>
                <dd className="break-all text-xs">{user.image}</dd>
              </div>
            ) : null}
            {user.currentKycSessionId ? (
              <div className="md:col-span-2">
                <AdminTechnicalIdDisclosure
                  triggerLabel="Show Veriff session ID"
                  items={[
                    {
                      label: "Current Veriff session",
                      value: user.currentKycSessionId,
                      copyLabel: "Veriff session ID",
                    },
                  ]}
                />
              </div>
            ) : null}
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
          </dl>
        </CollapsibleSection>
      ) : null}
    </div>
  );
}
