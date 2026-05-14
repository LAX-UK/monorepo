import { DashboardPage } from "@/components/dashboard/dashboard-page";
import { NotificationPreferencesForm } from "@/components/dashboard/notification-preferences-form";
import { DashboardErrorAlert } from "@/components/dashboard/primitives";
import { requireAuthenticatedUser } from "@/lib/auth/guards.server";
import { getServerDataContainer } from "@/lib/data/container.server";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
import { PageHeader } from "@auction/ui/components/page-header";
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
  const prefs = await c.notificationPreferences.getMine();

  if (!prefs) {
    return (
      <DashboardPage className="mx-auto max-w-3xl space-y-6">
        <Link
          href="/dashboard/notifications"
          className="font-label text-xs uppercase tracking-widest text-primary hover:underline"
        >
          Back to inbox
        </Link>
        <PageHeader
          title="Alert settings"
          description="Choose which alerts you want in-app and via browser push."
          className="border-0 pb-0"
        />
        <p className="mt-2 font-body text-sm text-on-surface-variant">
          Could not load notification preferences. Try again in a moment.
        </p>
      </DashboardPage>
    );
  }

  return (
    <DashboardPage className="mx-auto max-w-3xl space-y-6">
      <Link
        href="/dashboard/notifications"
        className="font-label text-xs uppercase tracking-widest text-primary hover:underline"
      >
        Back to inbox
      </Link>
      <PageHeader
        title="Alert settings"
        description="Choose which alerts you want in-app, via push, email, and WhatsApp."
        className="border-0 pb-0"
      />

      {saved ? (
        <Alert>
          <AlertTitle>Saved</AlertTitle>
          <AlertDescription>Your preferences were updated.</AlertDescription>
        </Alert>
      ) : null}
      {error ? <DashboardErrorAlert title="Could not save" message={error} /> : null}

      <NotificationPreferencesForm initial={prefs} />
    </DashboardPage>
  );
}
