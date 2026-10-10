import { AdminPanelPage } from "@/components/admin/admin-panel-page";
import { TwoFactorPolicyCard } from "@/components/security/two-factor-policy-card";
import { loadAdminSecuritySettingsPage } from "@/lib/admin/load-admin-security-settings-page";
import { requireAdminCapability } from "@/lib/auth/require-admin-capability";
import { PLATFORM_ADMIN_ACCESS } from "@/lib/navigation/staff-nav-access";
import { metadataForPrivate } from "@/lib/seo/metadata-factory";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
import type { Metadata } from "next";

export const metadata: Metadata = metadataForPrivate(
  "Security",
  "Sign-in security policy for LAX staff.",
);

export default async function AdminSecuritySettingsPage() {
  await requireAdminCapability(PLATFORM_ADMIN_ACCESS, "/admin/settings/security");
  const { staffTwoFactor: view } = await loadAdminSecuritySettingsPage();

  return (
    <AdminPanelPage
      title="Security"
      description="Applies to everyone with a staff role on any LAX platform — Bid admin and Shop Admin."
    >
      {view ? (
        <TwoFactorPolicyCard
          scope={{ kind: "staff" }}
          required={view.policy.required}
          members={view.coverage.members}
          enrolled={view.coverage.enrolled}
          canEdit
        />
      ) : (
        <Alert>
          <AlertTitle>Security policy unavailable</AlertTitle>
          <AlertDescription>
            We could not load the staff sign-in policy from LAX Identity. Try again shortly.
          </AlertDescription>
        </Alert>
      )}
    </AdminPanelPage>
  );
}
