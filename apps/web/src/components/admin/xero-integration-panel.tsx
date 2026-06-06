"use client";

import { AdminCopyField } from "@/components/admin/admin-copy-field";
import { XeroDisconnectSubmit } from "@/components/admin/xero-disconnect-submit";
import type { AdminXeroIntegrationStatus } from "@/lib/data/http/admin.server";
import { formatDateTime, formatRelativeTime } from "@/lib/ui/format";
import { Badge } from "@auction/ui/components/badge";
import { Button } from "@auction/ui/components/button";
import { cn } from "@auction/ui/lib/utils";

type Props = {
  status: AdminXeroIntegrationStatus;
  oauthStartAction: (formData: FormData) => Promise<void>;
  disconnectAction: (formData: FormData) => Promise<void>;
};

function healthLabel(status: AdminXeroIntegrationStatus): string {
  if (!status.connected) return "Not connected";
  if (status.connectionStatus === "needs_reauth") return "Action required";
  if (status.health === "degraded") return "Degraded";
  return "Connected · Healthy";
}

function healthBadgeVariant(
  status: AdminXeroIntegrationStatus,
): "default" | "secondary" | "destructive" | "outline" {
  if (!status.connected) return "outline";
  if (status.connectionStatus === "needs_reauth") return "destructive";
  if (status.health === "degraded") return "secondary";
  return "default";
}

export function XeroIntegrationPanel({ status, oauthStartAction, disconnectAction }: Props) {
  const scopeList = status.scopes?.split(/\s+/).filter(Boolean) ?? [];
  const showReconnect =
    status.connected &&
    (status.connectionStatus === "needs_reauth" || status.health === "degraded");

  return (
    <div className="space-y-6">
      <div
        className={cn(
          "rounded-2xl border border-border-hairline bg-surface-container-lowest p-6 shadow-sm",
          status.connectionStatus === "needs_reauth" && "border-destructive/40",
        )}
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Badge variant={healthBadgeVariant(status)} className="text-xs">
              {healthLabel(status)}
            </Badge>
            <p className="mt-3 text-sm text-on-surface-variant">
              {status.connected && status.tenantName
                ? `Invoices and payment sync use ${status.tenantName}.`
                : "Connect one Xero organisation for hosted invoices and payment collection."}
            </p>
            {status.connected ? (
              <p className="mt-2 text-xs text-on-surface-variant">
                You only need to reconnect if sync fails or Xero access is revoked. Access tokens
                renew automatically (~every 30 minutes).
              </p>
            ) : null}
            {status.connectionStatus === "needs_reauth" && status.lastRefreshError ? (
              <p className="mt-2 text-xs text-destructive">{status.lastRefreshError}</p>
            ) : null}
          </div>
          {!status.oauthConfigured ? (
            <p className="text-xs text-on-surface-variant">
              OAuth is not configured for this environment. Contact your platform administrator.
            </p>
          ) : null}
        </div>
      </div>

      {status.connected ? (
        <section className="rounded-2xl border border-border-hairline bg-surface-container-lowest p-6 shadow-sm">
          <h2 className="font-headline text-base text-on-surface">Connection</h2>
          <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
            <div className="rounded-xl border border-border-hairline bg-surface-container-low/35 p-4 sm:col-span-2">
              <dt className="font-label text-[10px] uppercase text-on-surface-variant">
                Organisation
              </dt>
              <dd className="mt-1 text-on-surface">{status.tenantName ?? "—"}</dd>
            </div>
            {status.tenantId ? (
              <div className="rounded-xl border border-border-hairline bg-surface-container-low/35 p-4 sm:col-span-2">
                <dt className="font-label text-[10px] uppercase text-on-surface-variant">
                  Tenant ID
                </dt>
                <dd className="mt-1">
                  <AdminCopyField value={status.tenantId} label="Tenant ID" />
                </dd>
              </div>
            ) : null}
            {status.orgShortCode || status.orgBaseCurrency ? (
              <div className="rounded-xl border border-border-hairline bg-surface-container-low/35 p-4">
                <dt className="font-label text-[10px] uppercase text-on-surface-variant">
                  Org short code
                </dt>
                <dd className="mt-1 text-xs text-on-surface">{status.orgShortCode ?? "—"}</dd>
              </div>
            ) : null}
            {status.orgShortCode || status.orgBaseCurrency ? (
              <div className="rounded-xl border border-border-hairline bg-surface-container-low/35 p-4">
                <dt className="font-label text-[10px] uppercase text-on-surface-variant">
                  Base currency
                </dt>
                <dd className="mt-1 text-xs text-on-surface">{status.orgBaseCurrency ?? "—"}</dd>
              </div>
            ) : null}
            <div className="rounded-xl border border-border-hairline bg-surface-container-low/35 p-4">
              <dt className="font-label text-[10px] uppercase text-on-surface-variant">
                Connected on
              </dt>
              <dd className="mt-1 text-on-surface">
                {status.connectedAt ? formatDateTime(status.connectedAt) : "—"}
              </dd>
            </div>
            <div className="rounded-xl border border-border-hairline bg-surface-container-low/35 p-4">
              <dt className="font-label text-[10px] uppercase text-on-surface-variant">
                Connected by
              </dt>
              <dd className="mt-1 text-on-surface">
                {status.connectedBy
                  ? `${status.connectedBy.name} (${status.connectedBy.email})`
                  : "—"}
              </dd>
            </div>
            {status.expiresAt ? (
              <div className="rounded-xl border border-border-hairline bg-surface-container-low/35 p-4 sm:col-span-2">
                <dt className="font-label text-[10px] uppercase text-on-surface-variant">
                  Access token renews automatically
                </dt>
                <dd className="mt-1 text-on-surface">
                  Next renewal {formatRelativeTime(status.expiresAt)}
                  <span className="mt-1 block text-xs text-on-surface-variant">
                    Last token rotation {status.updatedAt ? formatDateTime(status.updatedAt) : "—"}
                  </span>
                </dd>
              </div>
            ) : null}
            {scopeList.length > 0 ? (
              <div className="rounded-xl border border-border-hairline bg-surface-container-low/35 p-4 sm:col-span-2">
                <dt className="font-label text-[10px] uppercase text-on-surface-variant">
                  Scopes granted
                </dt>
                <dd className="mt-2 text-xs text-on-surface-variant">
                  {scopeList.length} permission{scopeList.length === 1 ? "" : "s"} approved for
                  invoice and payment sync.
                </dd>
              </div>
            ) : null}
            {status.syncErrorCount > 0 ? (
              <div className="rounded-xl border border-border-hairline bg-surface-container-low/35 p-4 sm:col-span-2">
                <dt className="font-label text-[10px] uppercase text-on-surface-variant">
                  Invoice sync errors
                </dt>
                <dd className="mt-1 text-on-surface">{status.syncErrorCount}</dd>
              </div>
            ) : null}
          </dl>
        </section>
      ) : null}

      <section className="rounded-2xl border border-border-hairline bg-surface-container-lowest p-6 shadow-sm">
        <h2 className="font-headline text-base text-on-surface">Webhooks</h2>
        <dl className="mt-4 grid gap-4 text-sm">
          <div className="rounded-xl border border-border-hairline bg-surface-container-low/35 p-4">
            <dt className="font-label text-[10px] uppercase text-on-surface-variant">
              Webhook configured
            </dt>
            <dd className="mt-1 text-on-surface">
              {status.webhookConfigured
                ? "Yes — payment events are delivered to the platform"
                : "Not configured — ask your platform administrator"}
            </dd>
          </div>
          {status.webhookUrl ? (
            <div className="rounded-xl border border-border-hairline bg-surface-container-low/35 p-4">
              <dt className="font-label text-[10px] uppercase text-on-surface-variant">
                Webhook URL
              </dt>
              <dd className="mt-1">
                <AdminCopyField value={status.webhookUrl} label="Webhook URL" />
              </dd>
              <p className="mt-2 text-xs text-on-surface-variant">
                Register this URL in your Xero organisation webhook settings.{" "}
                <a
                  href="https://developer.xero.com/documentation/guides/webhooks/overview/"
                  className="underline underline-offset-2"
                  target="_blank"
                  rel="noreferrer"
                >
                  Xero webhook guide (external)
                </a>
                .
              </p>
            </div>
          ) : null}
          {status.recentWebhookErrors > 0 ? (
            <div className="rounded-xl border border-border-hairline bg-surface-container-low/35 p-4">
              <dt className="font-label text-[10px] uppercase text-on-surface-variant">
                Webhook failures (24h)
              </dt>
              <dd className="mt-1 text-on-surface">{status.recentWebhookErrors}</dd>
            </div>
          ) : null}
        </dl>
      </section>

      <div className="flex flex-wrap gap-3">
        {status.oauthConfigured ? (
          <form action={oauthStartAction}>
            <Button
              type="submit"
              className="min-h-11"
              variant={!status.connected || showReconnect ? "default" : "outline"}
            >
              {status.connected ? "Reconnect to Xero" : "Connect to Xero"}
            </Button>
          </form>
        ) : null}
        {status.connected ? (
          <form id="xero-disconnect-form" action={disconnectAction}>
            <XeroDisconnectSubmit formId="xero-disconnect-form" />
          </form>
        ) : null}
      </div>
    </div>
  );
}
