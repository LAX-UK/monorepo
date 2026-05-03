import { NotificationPreferencesForm } from "@/components/dashboard/notification-preferences-form";
import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";
import { parseNotificationPreference } from "@/lib/data/http/parse";
import type { NotificationPreference } from "@auction/types";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
import { PageHeader } from "@auction/ui/components/page-header";
import Link from "next/link";

async function loadPrefs(): Promise<NotificationPreference | null> {
  try {
    const res = await authedServerFetch("/users/me/preferences/notifications");
    if (!res.ok) return null;
    const json = (await res.json()) as { data: unknown };
    return parseNotificationPreference(json.data);
  } catch {
    return null;
  }
}

export default async function NotificationSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const sp = await searchParams;
  const error = sp.error ? decodeURIComponent(sp.error) : null;
  const saved = sp.saved === "1";
  const prefs = await loadPrefs();

  if (!prefs) {
    return (
      <div className="mx-auto max-w-lg space-y-6">
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
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <Link
        href="/dashboard/notifications"
        className="font-label text-xs uppercase tracking-widest text-primary hover:underline"
      >
        Back to inbox
      </Link>
      <PageHeader
        title="Alert settings"
        description="Choose which alerts you want in-app and via browser push. Quiet hours apply to push only."
        className="border-0 pb-0"
      />

      {saved ? (
        <Alert>
          <AlertTitle>Saved</AlertTitle>
          <AlertDescription>Your preferences were updated.</AlertDescription>
        </Alert>
      ) : null}
      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Could not save</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <NotificationPreferencesForm initial={prefs} />
    </div>
  );
}
