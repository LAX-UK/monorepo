import { DashboardPage } from "@/components/dashboard/dashboard-page";
import { DashboardSliceErrorAlert } from "@/components/dashboard/dashboard-slice-error-alert";
import { NotificationPreferencesForm } from "@/components/dashboard/notification-preferences-form";
import { SavedSearchesPanel } from "@/components/dashboard/saved-searches-panel";
import { SettingsFormHeader } from "@/components/dashboard/settings-form-header";
import { requireAuthenticatedUser } from "@/lib/auth/guards.server";
import {
  describeDashboardSliceFailure,
  describeSettingsActionError,
} from "@/lib/dashboard/dashboard-fetch-errors";
import { getServerDataContainer } from "@/lib/data/container.server";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
import { Surface } from "@auction/ui/components/surface";
import Link from "next/link";

export default async function NotificationSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const sp = await searchParams;
  const error = sp.error ? decodeURIComponent(sp.error) : null;
  const saved = sp.saved === "1";

  await requireAuthenticatedUser({
    shell: "client",
    loginNext: "/dashboard/settings/notifications",
  });

  const c = await getServerDataContainer();
  let prefs = null;
  let loadFailure = null;
  try {
    prefs = await c.notificationPreferences.getMine();
    if (!prefs) {
      loadFailure = describeDashboardSliceFailure(
        new Error("preferences_unavailable"),
        "notifications",
        "Could not load notification preferences.",
      );
    }
  } catch (e) {
    loadFailure = describeDashboardSliceFailure(
      e,
      "notifications",
      "Could not load notification preferences.",
    );
  }

  return (
    <DashboardPage className="mx-auto max-w-3xl space-y-6">
      <Link
        href="/dashboard/notifications"
        className="font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-primary hover:underline"
      >
        Back to inbox
      </Link>
      <SettingsFormHeader title="Alert settings" />

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

      {!loadFailure && prefs ? (
        <>
          <Surface variant="section" padding="md">
            <NotificationPreferencesForm initial={prefs} />
          </Surface>
          <Surface variant="section" padding="md" className="space-y-4">
            <div>
              <h2 className="font-headline text-lg font-semibold text-on-surface">
                Saved searches
              </h2>
              <p className="mt-1 font-body text-sm text-on-surface-variant">
                Manage catalogue filters you saved from search.
              </p>
            </div>
            <SavedSearchesPanel />
          </Surface>
        </>
      ) : null}
    </DashboardPage>
  );
}
