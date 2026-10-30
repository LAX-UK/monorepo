import { DashboardListPage } from "@/components/dashboard/dashboard-list-page";
import { AccountListSkeleton } from "@/components/dashboard/primitives/account-list-skeleton";
import {
  AppearanceSettings,
  BiddingSettings,
  InterestsSettings,
  NotificationSettings,
  ProfileAndSecurity,
} from "@/components/dashboard/settings/bid-settings-sections";
import { requireAuthenticatedUser } from "@/lib/auth/guards.server";
import { laxAccountUrl } from "@/lib/lax-account-url";
import { resolveActingContext } from "@/lib/legal-entity/acting-context.server";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

export const metadata: Metadata = { title: "Bid settings" };

function SectionLoading({ label }: { label: string }) {
  return <AccountListSkeleton label={label} tabs={false} className="py-8" />;
}

/**
 * Bid settings in one calm column: bidding, notifications, interests, appearance, and the one
 * link to LAX Account for name, email, password and addresses. Each section loads on its own,
 * so a slow or failed one never holds up the rest.
 *
 * Links in older emails ask for `?tab=security`; they now go to the same place in LAX Account.
 */
export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const sp = await searchParams;
  if (sp.tab === "security") redirect(laxAccountUrl("/account/security"));
  const user = await requireAuthenticatedUser({ shell: "client", loginNext: "/settings" });

  const { acting } = await resolveActingContext(user.role, user.staffRoles);
  const organisation =
    acting.kind === "organisation"
      ? { name: acting.displayName, status: acting.status, role: acting.role }
      : null;

  return (
    <DashboardListPage
      title="Bid settings"
      description="How bidding and selling work for you on LAX Bid."
    >
      <div className="max-w-5xl">
        <BiddingSettings user={user} organisation={organisation} />
        <Suspense fallback={<SectionLoading label="Loading notification settings" />}>
          <NotificationSettings user={user} />
        </Suspense>
        {/* Organisations bid on behalf of a business; interests are a personal taste. */}
        {user.signupPersona === "organisation" ? null : (
          <Suspense fallback={<SectionLoading label="Loading interests" />}>
            <InterestsSettings />
          </Suspense>
        )}
        <AppearanceSettings user={user} />
        <ProfileAndSecurity />
      </div>
    </DashboardListPage>
  );
}
