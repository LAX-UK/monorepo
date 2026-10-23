import { DashboardPage } from "@/components/dashboard/dashboard-page";
import { SettingsFormHeader } from "@/components/dashboard/settings-form-header";
import { requireAuthenticatedUser } from "@/lib/auth/guards.server";
import { laxAccountUrl } from "@/lib/lax-account-url";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Bid settings" };

/**
 * The settings index. The list itself (bidding limits, alerts, interests, appearance, and the one
 * LAX Account link) is the settings navigation beside or above every settings page, so this page
 * only introduces it. Name, email, password and addresses are not here: they are in LAX Account.
 *
 * Links in older emails ask for `?tab=security`; they now go to the same place in LAX Account.
 */
export default async function SettingsIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const sp = await searchParams;
  if (sp.tab === "security") redirect(laxAccountUrl("/account/security"));

  await requireAuthenticatedUser({
    shell: "client",
    loginNext: "/dashboard/settings",
  });

  return (
    <DashboardPage className="space-y-4">
      <SettingsFormHeader
        title="Bid settings"
        description="Choose a setting to change how you bid, what you hear about and how Bid looks. Your name, email, password, security and addresses are in LAX Account."
        hideTitleOnMobile={false}
        hideDescriptionOnMobile={false}
      />
    </DashboardPage>
  );
}
