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
    <div className="mx-auto w-full max-w-[var(--container-inner,1376px)] space-y-8">
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
        <div className="rounded-xl border border-outline-variant/15 bg-surface-container-low/40 p-6 shadow-sm">
          <dl className="grid gap-3 text-sm">
            <div>
              <dt className="font-label text-[10px] uppercase text-on-surface-variant">
                OAuth configured
              </dt>
              <dd>{status.oauthConfigured ? "Yes" : "No (set XERO_* env on API)"}</dd>
            </div>
            <div>
              <dt className="font-label text-[10px] uppercase text-on-surface-variant">
                Connected
              </dt>
              <dd>{status.connected ? "Yes" : "No"}</dd>
            </div>
            {status.tenantName ? (
              <div>
                <dt className="font-label text-[10px] uppercase text-on-surface-variant">
                  Organisation
                </dt>
                <dd>{status.tenantName}</dd>
              </div>
            ) : null}
            {status.expiresAt ? (
              <div>
                <dt className="font-label text-[10px] uppercase text-on-surface-variant">
                  Token expiry (UTC)
                </dt>
                <dd className="font-mono text-xs">{status.expiresAt}</dd>
              </div>
            ) : null}
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

          <p className="mt-6 font-body text-xs text-on-surface-variant">
            Webhook URL for Xero:{" "}
            <span className="break-all font-mono">
              {process.env.NEXT_PUBLIC_API_URL ?? process.env.INTERNAL_API_URL ?? ""}/webhooks/xero
            </span>
          </p>
        </div>
      ) : null}
    </div>
  );
}
