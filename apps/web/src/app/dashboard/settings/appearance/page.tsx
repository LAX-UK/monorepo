import { DashboardPage } from "@/components/dashboard/dashboard-page";
import { AppearanceSettingsForm } from "@/components/settings/appearance-settings-form";
import { ReduceMotionCard } from "@/components/settings/reduce-motion-card";
import { requireAuthenticatedUser } from "@/lib/auth/guards.server";
import { PageHeader } from "@auction/ui/components/page-header";
import type { ThemePreference } from "@auction/validators";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Appearance" };

export default async function AppearanceSettingsPage() {
  const user = await requireAuthenticatedUser({
    shell: "client",
    loginNext: "/dashboard/settings/appearance",
  });

  const initialTheme: ThemePreference = user.uiPreferences?.theme ?? "system";

  return (
    <DashboardPage className="mx-auto max-w-xl space-y-8">
      <PageHeader
        title="Appearance"
        description="Colour scheme and motion preferences for your account."
        className="border-0 pb-0"
      />
      <section className="space-y-3" aria-labelledby="theme-heading">
        <h2
          id="theme-heading"
          className="font-label text-xs font-bold uppercase tracking-widest text-on-surface-variant"
        >
          Colour scheme
        </h2>
        <AppearanceSettingsForm initialTheme={initialTheme} />
      </section>
      <ReduceMotionCard />
      <p className="text-sm text-on-surface-variant">
        Quick toggle is also in the site header.{" "}
        <Link
          href="/dashboard/settings/account"
          className="text-primary underline-offset-4 hover:underline"
        >
          Account &amp; email
        </Link>{" "}
        for sign-in details.
      </p>
    </DashboardPage>
  );
}
