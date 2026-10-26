import { StaffTwoFactorPolicy } from "@/components/admin/settings/staff-two-factor-policy";
import { loadAdminSecuritySettingsPage } from "@/lib/admin/load-admin-security-settings-page";
import { requireAdminCapability } from "@/lib/auth/require-admin-capability";
import { PLATFORM_ADMIN_ACCESS } from "@/lib/navigation/staff-nav-access";
import { metadataForPrivate } from "@/lib/seo/metadata-factory";
import { FormPage, Notice } from "@auction/staff-ui";
import type { Metadata } from "next";

export const metadata: Metadata = metadataForPrivate(
  "Security",
  "Sign-in security policy for LAX staff.",
);

export default async function AdminSecuritySettingsPage() {
  await requireAdminCapability(PLATFORM_ADMIN_ACCESS, "/admin/settings/security");
  const { staffTwoFactor: view } = await loadAdminSecuritySettingsPage();

  return (
    <FormPage title="Security" description="How LAX staff sign in, across Bid admin and LAX Admin.">
      {view ? (
        <StaffTwoFactorPolicy
          required={view.policy.required}
          members={view.coverage.members}
          enrolled={view.coverage.enrolled}
          canEdit
        />
      ) : (
        <Notice tone="warning" title="The sign-in policy could not load">
          LAX Identity did not answer. Try again in a moment.
        </Notice>
      )}
    </FormPage>
  );
}
