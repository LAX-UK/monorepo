import { updateBiddingPreferencesAction } from "@/lib/actions/user-bidding-preferences";
import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
import { Button } from "@auction/ui/components/button";
import { Input } from "@auction/ui/components/input";
import { Label } from "@auction/ui/components/label";
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

      <form action={updateBiddingPreferencesAction} className="space-y-8">
        <div className="flex items-start justify-between gap-4 rounded-lg border border-outline-variant/15 p-4">
          <div className="min-w-0">
            <Label htmlFor="outbidInApp" className="text-on-surface">
              In-app outbid alerts
            </Label>
            <p className="text-xs text-on-surface-variant">Banner + inbox when you are outbid.</p>
          </div>
          <input
            id="outbidInApp"
            name="outbidInApp"
            type="checkbox"
            value="true"
            defaultChecked={prefs?.outbidInApp ?? true}
            className="mt-1 size-5 shrink-0 rounded border border-outline-variant text-primary focus-visible:outline focus-visible:ring-2 focus-visible:ring-primary"
          />
        </div>
        <div className="flex items-start justify-between gap-4 rounded-lg border border-outline-variant/15 p-4">
          <div className="min-w-0">
            <Label htmlFor="outbidPush" className="text-on-surface">
              Push outbid alerts
            </Label>
            <p className="text-xs text-on-surface-variant">Requires an enabled push subscription.</p>
          </div>
          <input
            id="outbidPush"
            name="outbidPush"
            type="checkbox"
            value="true"
            defaultChecked={prefs?.outbidPush ?? true}
            className="mt-1 size-5 shrink-0 rounded border border-outline-variant text-primary focus-visible:outline focus-visible:ring-2 focus-visible:ring-primary"
          />
        </div>
        <div className="flex items-start justify-between gap-4 rounded-lg border border-outline-variant/15 p-4">
          <div className="min-w-0">
            <Label htmlFor="endingSoonPush" className="text-on-surface">
              Ending soon (push)
            </Label>
          </div>
          <input
            id="endingSoonPush"
            name="endingSoonPush"
            type="checkbox"
            value="true"
            defaultChecked={prefs?.endingSoonPush ?? false}
            className="mt-1 size-5 shrink-0 rounded border border-outline-variant text-primary focus-visible:outline focus-visible:ring-2 focus-visible:ring-primary"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="defaultMaxBidAmount">Default max bid (optional)</Label>
          <Input
            id="defaultMaxBidAmount"
            name="defaultMaxBidAmount"
            placeholder="e.g. 5000"
            className="text-base md:text-sm"
          />
          <p className="text-xs text-on-surface-variant">
            Hint for quick bid forms; server stores notification prefs only today.
          </p>
        </div>
        <Button type="submit" className="min-h-11 w-full sm:w-auto">
          Save preferences
        </Button>
      </form>
    </div>
  );
}
