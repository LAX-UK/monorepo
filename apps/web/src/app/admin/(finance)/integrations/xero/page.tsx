import { AdminPanelPage } from "@/components/admin/admin-panel-page";
import { XeroIntegrationPanel } from "@/components/admin/xero-integration-panel";
import { adminXeroDisconnectAction, adminXeroOAuthStartAction } from "@/lib/actions/admin";
import { getAdminXeroIntegrationStatus } from "@/lib/data/http/admin.server";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";

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
    <AdminPanelPage
      className="max-w-[640px]"
      title="Xero"
      description="Connect one Xero organisation for hosted invoices and payment collection."
    >
      {error ? (
        <Alert variant="destructive" className="mb-6">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {connected && !error ? (
        <Alert className="mb-6">
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
        <XeroIntegrationPanel
          status={status}
          oauthStartAction={adminXeroOAuthStartAction}
          disconnectAction={adminXeroDisconnectAction}
        />
      ) : null}
    </AdminPanelPage>
  );
}
