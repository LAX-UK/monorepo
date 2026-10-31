import { DashboardListPage } from "@/components/dashboard/dashboard-list-page";
import {
  AlertsSection,
  AppearanceSection,
  BiddingSettings,
  InterestsSettings,
} from "@/components/dashboard/settings/bid-settings-sections";
import { SetMobileShellTitle } from "@/components/layout/set-mobile-shell-title";
import { requireAuthenticatedUser } from "@/lib/auth/guards.server";
import { laxAccountUrl } from "@/lib/lax-account-url";
import { resolveActingContext } from "@/lib/legal-entity/acting-context.server";
import { Skeleton } from "@auction/ui/lax";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

export const metadata: Metadata = { title: "Bid settings" };

function SectionLoading({ label }: { label: string }) {
  return (
    <output
      aria-label={label}
      className="grid gap-4 border-t border-lax-line py-8 md:grid-cols-[256px_minmax(0,1fr)] md:gap-10"
    >
      <span className="flex flex-col gap-2">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-4 w-48 max-w-full" />
      </span>
      <Skeleton className="h-40 w-full rounded-lax-card" />
    </output>
  );
}

/**
 * Bid settings: Bidding, Alerts and Appearance (and Interests for a person on their own), each at
 * its own address (`/settings#alerts`). Each section loads on its own, so a slow or failed one
 * never holds up or breaks the rest. Name, email and sign-in are in LAX Account.
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
  const { acting, memberships } = await resolveActingContext(user.role, user.staffRoles);
  const organisation = acting.kind === "organisation" ? acting.displayName : null;
  const belongsToOrganisations = memberships.some((m) => m.kind === "organisation");

  return (
    <DashboardListPage
      title="Bid settings"
      description={`How bidding and alerts work for ${organisation ?? "you"}. Your name, email and sign-in are in LAX Account.`}
    >
      <SetMobileShellTitle title="Bid settings" />
      <div className="max-w-[960px]">
        <Suspense fallback={<SectionLoading label="Loading bidding" />}>
          <BiddingSettings user={user} />
        </Suspense>
        <Suspense fallback={<SectionLoading label="Loading alerts" />}>
          <AlertsSection user={user} belongsToOrganisations={belongsToOrganisations} />
        </Suspense>
        {/* Organisations bid on behalf of a business; interests are a personal taste. */}
        {organisation || user.signupPersona === "organisation" ? null : (
          <Suspense fallback={<SectionLoading label="Loading interests" />}>
            <InterestsSettings />
          </Suspense>
        )}
        <AppearanceSection user={user} />
      </div>
    </DashboardListPage>
  );
}
