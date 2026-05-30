import { BiddingPreferencesForm } from "@/components/dashboard/bidding-preferences-form";
import { DashboardPage } from "@/components/dashboard/dashboard-page";
import { DashboardSliceErrorAlert } from "@/components/dashboard/dashboard-slice-error-alert";
import { SettingsFormHeader } from "@/components/dashboard/settings-form-header";
import { requireAuthenticatedUser } from "@/lib/auth/guards.server";
import {
  describeDashboardSliceFailure,
  describeSettingsActionError,
} from "@/lib/dashboard/dashboard-fetch-errors";
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
  let prefs: BiddingPrefsSlice | null = null;
  let loadFailure = null;
  try {
    const full = await c.notificationPreferences.getMine();
    if (!full) {
      loadFailure = describeDashboardSliceFailure(
        new Error("preferences_unavailable"),
        "notifications",
        "Could not load bidding preferences.",
      );
    } else {
      prefs = {
        outbidInApp: full.outbidInApp,
        outbidPush: full.outbidPush,
        endingSoonPush: full.endingSoonPush,
      };
    }
  } catch (e) {
    loadFailure = describeDashboardSliceFailure(
      e,
      "notifications",
      "Could not load bidding preferences.",
    );
  }

  return (
    <DashboardPage className="space-y-8">
      <SettingsFormHeader title="Bidding preferences" />
      {loadFailure ? <DashboardSliceErrorAlert failure={loadFailure} /> : null}
      {!loadFailure && saved ? (
        <Alert>
          <AlertTitle>Saved</AlertTitle>
          <AlertDescription>Your preferences were updated.</AlertDescription>
        </Alert>
      ) : null}
      {!loadFailure && error ? (
        <DashboardSliceErrorAlert failure={describeSettingsActionError(error)} />
      ) : null}

      {!loadFailure && prefs ? <BiddingPreferencesForm initial={prefs} /> : null}
    </DashboardPage>
  );
}
