import { DashboardPage } from "@/components/dashboard/dashboard-page";
import { SettingsFormHeader } from "@/components/dashboard/settings-form-header";
import {
  AppearanceLayoutPreferencesForm,
  type AppearancePreferencesSnapshot,
} from "@/components/settings/appearance-layout-preferences-form";
import { ReduceMotionCard } from "@/components/settings/reduce-motion-card";
import { requireAuthenticatedUser } from "@/lib/auth/guards.server";
import type { DensityPreference, LayoutViewDefault, ThemePreference } from "@auction/validators";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Appearance & layout" };

export default async function AppearanceSettingsPage() {
  const user = await requireAuthenticatedUser({
    shell: "client",
    loginNext: "/dashboard/settings/appearance",
  });

  const p = user.uiPreferences;
  const initial: AppearancePreferencesSnapshot = {
    theme: (p?.theme ?? "system") as ThemePreference,
    viewLotsDefault: (p?.viewLotsDefault ?? "auto") as LayoutViewDefault,
    viewArtistsDefault: (p?.viewArtistsDefault ?? "auto") as LayoutViewDefault,
    viewSalesDefault: (p?.viewSalesDefault ?? "auto") as LayoutViewDefault,
    density: (p?.density ?? "comfortable") as DensityPreference,
    viewSync: p?.viewSync ?? false,
  };

  return (
    <DashboardPage className="space-y-8">
      <SettingsFormHeader title="Appearance & layout" />
      <AppearanceLayoutPreferencesForm initial={initial} />
      <ReduceMotionCard />
      <p className="text-sm text-on-surface-variant">
        Quick theme toggle is also in the site header.{" "}
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
