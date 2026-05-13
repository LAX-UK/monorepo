import { AppScreen } from "@/components/dashboard/dashboard-page";
import { adminXeroDisconnectAction, adminXeroOAuthStartAction } from "@/lib/actions/admin";
import { getAdminXeroIntegrationStatus } from "@/lib/data/http/admin.server";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
import { Button } from "@auction/ui/components/button";
import { PageHeader } from "@auction/ui/components/page-header";

export default async function AdminXeroIntegrationPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; connected?: string }>;
}) {
  const sp = await searchParams;
  const error = sp.error ? decodeURIComponent(sp.error) : null;
  const connected = sp.connected === "1";

  let status: Awaited<ReturnType<typeof getAdminXeroIntegrationStatus>> | null = null;
  let loadError: string | null = null;
  try {
    status = await getAdminXeroIntegrationStatus();
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Could not load Xero status.";
  }

  return (
    <AppScreen className="max-w-[560px] space-y-6">
      <PageHeader
        title="Xero"
        description="Connect one Xero organisation for hosted invoices and payment collection. Redirect URI must match your Xero app and environment variables."
      />

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {connected ? (
        <Alert>
          <AlertTitle>Connected</AlertTitle>
          <AlertDescription>Xero authorisation completed.</AlertDescription>
        </Alert>
      ) : null}

      {loadError ? (
        <Alert variant="destructive">
          <AlertTitle>Could not load status</AlertTitle>
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      ) : null}

      {status ? (
        <div className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-6 shadow-sm">
          <dl className="grid gap-4 text-sm sm:grid-cols-2">
            <div className="rounded-xl border border-outline-variant/10 bg-surface-container-low/35 p-4">
              <dt className="font-label text-[10px] uppercase text-on-surface-variant">
                OAuth configured
              </dt>
              <dd className="mt-1 font-headline text-lg text-on-surface">
                {status.oauthConfigured ? "Yes" : "No"}
              </dd>
              {!status.oauthConfigured ? (
                <p className="mt-1 text-xs text-on-surface-variant">Set XERO_* env on API.</p>
              ) : null}
            </div>
            <div className="rounded-xl border border-outline-variant/10 bg-surface-container-low/35 p-4">
              <dt className="font-label text-[10px] uppercase text-on-surface-variant">
                Connected
              </dt>
              <dd className="mt-1 font-headline text-lg text-on-surface">
                {status.connected ? "Yes" : "No"}
              </dd>
            </div>
            {status.tenantName ? (
              <div className="rounded-xl border border-outline-variant/10 bg-surface-container-low/35 p-4">
                <dt className="font-label text-[10px] uppercase text-on-surface-variant">
                  Organisation
                </dt>
                <dd className="mt-1 text-on-surface">{status.tenantName}</dd>
              </div>
            ) : null}
            {status.tokenExpiresAt || status.expiresAt ? (
              <div className="rounded-xl border border-outline-variant/10 bg-surface-container-low/35 p-4">
                <dt className="font-label text-[10px] uppercase text-on-surface-variant">
                  Token expiry (UTC)
                </dt>
                <dd className="mt-1 font-mono text-xs">
                  {status.tokenExpiresAt ?? status.expiresAt}
                </dd>
              </div>
            ) : null}
            <div className="rounded-xl border border-outline-variant/10 bg-surface-container-low/35 p-4 sm:col-span-2">
              <dt className="font-label text-[10px] uppercase text-on-surface-variant">
                Webhook URL
              </dt>
              <dd className="mt-1 break-all font-mono text-xs">
                {status.webhookUrl ??
                  `${process.env.NEXT_PUBLIC_API_URL ?? process.env.INTERNAL_API_URL ?? ""}/webhooks/xero`}
              </dd>
            </div>
          </dl>

          <div className="mt-6 flex flex-wrap gap-3">
            {status.oauthConfigured ? (
              <form action={adminXeroOAuthStartAction}>
                <Button type="submit" className="min-h-11">
                  {status.connected ? "Reconnect to Xero" : "Connect to Xero"}
                </Button>
              </form>
            ) : null}
            {status.connected ? (
              <form action={adminXeroDisconnectAction}>
                <Button type="submit" variant="secondary" className="min-h-11 text-error">
                  Disconnect
                </Button>
              </form>
            ) : null}
          </div>
        </div>
      ) : null}
    </AppScreen>
  );
}
