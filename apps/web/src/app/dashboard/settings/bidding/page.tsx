import { BiddingPreferencesForm } from "@/components/dashboard/bidding-preferences-form";
import { DashboardPage } from "@/components/dashboard/dashboard-page";
import { DashboardErrorAlert } from "@/components/dashboard/primitives";
import { SettingsFormHeader } from "@/components/dashboard/settings-form-header";
import { requireAuthenticatedUser } from "@/lib/auth/guards.server";
import { getServerDataContainer } from "@/lib/data/container.server";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";

type BiddingPrefsSlice = {
  outbidInApp: boolean;
  outbidPush: boolean;
  endingSoonPush: boolean;
};

export default async function BiddingSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const sp = await searchParams;
  const error = sp.error ? decodeURIComponent(sp.error) : null;
  const saved = sp.saved === "1";

  await requireAuthenticatedUser({
    shell: "client",
    loginNext: "/dashboard/settings/bidding",
  });

  const c = await getServerDataContainer();
  const full = await c.notificationPreferences.getMine();
  const prefs: BiddingPrefsSlice | null = full
    ? {
        outbidInApp: full.outbidInApp,
        outbidPush: full.outbidPush,
        endingSoonPush: full.endingSoonPush,
      }
    : null;

  return (
    <DashboardPage className="mx-auto max-w-2xl space-y-8">
      <SettingsFormHeader title="Bidding preferences" />
      {saved ? (
        <Alert>
          <AlertTitle>Saved</AlertTitle>
          <AlertDescription>Your preferences were updated.</AlertDescription>
        </Alert>
      ) : null}
      {error ? <DashboardErrorAlert title="Could not save" message={error} /> : null}

      <BiddingPreferencesForm initial={prefs} />
    </DashboardPage>
  );
}
