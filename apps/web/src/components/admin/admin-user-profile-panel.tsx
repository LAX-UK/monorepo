import { formatEmailDeliverabilityStatus, formatUserRole } from "@/lib/admin/admin-user-presenters";
import { formatBirthDate } from "@/lib/admin/people/format-birth-date";
import { staffIdentityStatus, staffStatus } from "@/lib/admin/staff-kit-status";
import { staffRoleLabel } from "@/lib/admin/staff-role-presenter";
import { formatAmlHoldReason } from "@/lib/admin/status-badge-variants";
import type { AdminUserDetailPayload } from "@/lib/data/http/admin.server";
import { formatSignupPersona } from "@/lib/presenters/signup-persona/signup-persona-registry";
import {
  type KeyValueItem,
  KeyValueList,
  Section,
  StaffDate,
  StatusBadge,
} from "@auction/staff-ui";
import type { UserStaffRole } from "@auction/types";
import { formatPhoneDisplay } from "@auction/validators";

const LINK = "underline underline-offset-2";

function dateTime(value: string | null) {
  return value ? <StaffDate value={value} withTime className="text-staff-fg" /> : null;
}

/** Who the person is and how their account stands, as two kit sections of plain facts. */
export function AdminUserProfilePanel({ user }: { user: AdminUserDetailPayload }) {
  const isStaff = user.role === "staff";
  const mobile = formatPhoneDisplay(user.mobile);
  const standing = staffStatus("user", user.suspendedAt ? "suspended" : "active");
  const identity = staffIdentityStatus(user.kycStatus);
  const holdReason = formatAmlHoldReason(user.amlHoldReason);

  const profile: KeyValueItem[] = [
    { label: "Full name", value: user.name },
    { label: "Email", value: user.email, copyValue: user.email },
    {
      label: "Mobile",
      value: mobile ? `${mobile}${user.mobileCountry ? ` (${user.mobileCountry})` : ""}` : null,
    },
    { label: "Date of birth", value: formatBirthDate(user.dateOfBirth) },
    { label: "Account type", value: formatUserRole(user.role) },
    ...(isStaff
      ? [{ label: "Staff role", value: staffRoleLabel(user.staffRole as UserStaffRole | null) }]
      : [{ label: "Signed up as", value: formatSignupPersona(user.signupPersona) }]),
    { label: "Created", value: dateTime(user.createdAt) },
    { label: "Last updated", value: dateTime(user.updatedAt) },
    {
      label: "Account status",
      value: <StatusBadge tone={standing.tone}>{standing.label}</StatusBadge>,
    },
    ...(user.suspendedAt ? [{ label: "Suspended", value: dateTime(user.suspendedAt) }] : []),
    ...(user.suspendedReason ? [{ label: "Suspension reason", value: user.suspendedReason }] : []),
    ...(user.deletionRequestedAt
      ? [{ label: "Deletion requested", value: dateTime(user.deletionRequestedAt) }]
      : []),
    ...(user.image
      ? [
          {
            label: "Profile photo",
            value: (
              <a href={user.image} target="_blank" rel="noopener noreferrer" className={LINK}>
                View photo
              </a>
            ),
          },
        ]
      : []),
    { label: "User ID", value: user.id, copyValue: user.id },
  ];

  const security: KeyValueItem[] = [
    { label: "Email address", value: user.emailVerified ? "Verified" : "Not verified" },
    { label: "Email delivery", value: formatEmailDeliverabilityStatus(user.emailStatus) },
    ...(user.emailStatusChangedAt
      ? [{ label: "Delivery changed", value: dateTime(user.emailStatusChangedAt) }]
      : []),
    ...(user.pendingNewEmail
      ? [
          {
            label: "Pending email change",
            value: user.emailChangeExpiresAt ? (
              <>
                {user.pendingNewEmail}, expires {dateTime(user.emailChangeExpiresAt)}
              </>
            ) : (
              user.pendingNewEmail
            ),
          },
        ]
      : []),
    {
      label: "Two-step verification",
      value: user.securityStatusAvailable ? (user.twoFactorEnabled ? "On" : "Off") : "Unavailable",
    },
    ...(isStaff
      ? []
      : [
          {
            label: "Identity",
            value: <StatusBadge tone={identity.tone}>{identity.label}</StatusBadge>,
          },
          ...(user.kycVerifiedAt
            ? [{ label: "Identity verified", value: dateTime(user.kycVerifiedAt) }]
            : []),
          { label: "Identity retries", value: String(user.kycRetryCount), numeric: true },
          ...(user.currentKycSessionId
            ? [
                {
                  label: "Current identity session ID",
                  value: user.currentKycSessionId,
                  copyValue: user.currentKycSessionId,
                },
              ]
            : []),
          ...(user.amlHoldStatus && user.amlHoldStatus !== "none"
            ? [
                {
                  label: "AML hold",
                  value: (
                    <>
                      <StatusBadge tone={staffStatus("amlHold", user.amlHoldStatus).tone}>
                        {staffStatus("amlHold", user.amlHoldStatus).label}
                      </StatusBadge>
                      {holdReason ? ` ${holdReason}` : ""}
                      {user.amlHoldAt ? <> since {dateTime(user.amlHoldAt)}</> : null}
                    </>
                  ),
                },
              ]
            : []),
        ]),
  ];

  return (
    <>
      <Section
        id="profile"
        title="Profile"
        description="Contact details and account."
        className="scroll-mt-20"
      >
        <KeyValueList items={profile} columns={2} />
      </Section>
      <Section
        id="security"
        title={isStaff ? "Security" : "Security and verification"}
        description={
          isStaff ? "Sign-in protection." : "Email, two-step verification and the identity check."
        }
        className="scroll-mt-20"
      >
        <KeyValueList items={security} columns={2} />
      </Section>
    </>
  );
}
