import { BiddingPreferencesForm } from "@/components/dashboard/bidding-preferences-form";
import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
import { PageHeader } from "@auction/ui/components/page-header";

type Prefs = {
  outbidInApp: boolean;
  outbidPush: boolean;
  endingSoonPush: boolean;
};

async function loadPrefs(): Promise<Prefs | null> {
  try {
    const res = await authedServerFetch("/users/me/preferences/notifications");
    if (!res.ok) return null;
    const json = (await res.json()) as { data: Prefs };
    return json.data;
  } catch {
    return null;
  }
}

export default async function BiddingSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const sp = await searchParams;
  const error = sp.error ? decodeURIComponent(sp.error) : null;
  const saved = sp.saved === "1";
  const prefs = await loadPrefs();

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <PageHeader
        title="Bidding preferences"
        description="Outbid alerts and optional default ceiling (stored in-app; syncs notification preferences)."
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

      <BiddingPreferencesForm initial={prefs} />
    </div>
  );
}
