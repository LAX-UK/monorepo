"use client";

import { StaffBreadcrumbs } from "@/components/admin/staff/staff-breadcrumbs";
import type { AdminXeroIntegrationStatus } from "@/lib/data/http/admin.server";
import {
  ConfirmActionDialog,
  type KeyValueItem,
  KeyValueList,
  Notice,
  type OverflowAction,
  OverflowMenu,
  PageHeader,
  RelativeTime,
  Section,
  StaffButton,
  StatusBadge,
  type StatusPresentation,
  TextLink,
  formatStaffDateTime,
} from "@auction/staff-ui";
import { Unplug } from "lucide-react";
import { type ReactNode, useRef, useState, useTransition } from "react";

type Props = {
  status: AdminXeroIntegrationStatus;
  oauthStartAction: (formData: FormData) => Promise<void>;
  disconnectAction: (formData: FormData) => Promise<void>;
  /** Notices from the page: a failed connection, a status that could not load. */
  notice?: ReactNode;
};

/** The connection's state in words and a tone; never the raw status. */
export function xeroHealth(status: AdminXeroIntegrationStatus): StatusPresentation {
  if (!status.connected) return { label: "Not connected", tone: "neutral" };
  if (status.connectionStatus === "needs_reauth")
    return { label: "Needs reconnecting", tone: "danger" };
  if (status.health === "degraded") return { label: "Degraded", tone: "warning" };
  return { label: "Connected", tone: "success" };
}

const when = (iso: string | null) => (iso ? formatStaffDateTime(iso, { zoneLabel: true }) : null);

/**
 * Bid's link to Xero for hosted invoices and payment sync: its state and organisation in the
 * header with Connect (or Reconnect when it needs it) as the one action, then the connection and
 * webhook facts with copyable IDs. Disconnect sits in the overflow menu and asks first.
 */
export function XeroIntegrationPanel({
  status,
  oauthStartAction,
  disconnectAction,
  notice,
}: Props) {
  const disconnectForm = useRef<HTMLFormElement>(null);
  const [confirming, setConfirming] = useState(false);
  const [disconnecting, startDisconnect] = useTransition();
  const health = xeroHealth(status);
  const needsReconnect =
    status.connected &&
    (status.connectionStatus === "needs_reauth" || status.health === "degraded");
  const scopes = status.scopes?.split(/\s+/).filter(Boolean) ?? [];

  const connection: KeyValueItem[] = [
    { label: "Organisation", value: status.tenantName },
    ...(status.tenantId
      ? [{ label: "Tenant ID", value: status.tenantId, copyValue: status.tenantId }]
      : []),
    { label: "Short code", value: status.orgShortCode },
    { label: "Base currency", value: status.orgBaseCurrency },
    { label: "Connected", value: when(status.connectedAt) },
    {
      label: "Connected by",
      value: status.connectedBy ? `${status.connectedBy.name} · ${status.connectedBy.email}` : null,
    },
    ...(status.expiresAt
      ? [
          {
            label: "Access renews",
            value: <RelativeTime value={status.expiresAt} />,
          },
          { label: "Last renewed", value: when(status.updatedAt) },
        ]
      : []),
    ...(scopes.length > 0
      ? [
          {
            label: "Permissions",
            value: `${scopes.length} approved for invoice and payment sync`,
          },
        ]
      : []),
    ...(status.syncErrorCount > 0
      ? [{ label: "Invoice sync errors", value: String(status.syncErrorCount), numeric: true }]
      : []),
  ];

  const webhooks: KeyValueItem[] = [
    {
      label: "Payment events",
      value: status.webhookConfigured
        ? "Delivered to Bid"
        : "Not set up. Ask your platform administrator.",
    },
    ...(status.webhookUrl
      ? [{ label: "Webhook URL", value: status.webhookUrl, copyValue: status.webhookUrl }]
      : []),
    ...(status.recentWebhookErrors > 0
      ? [
          {
            label: "Failures, last 24 hours",
            value: String(status.recentWebhookErrors),
            numeric: true,
          },
        ]
      : []),
  ];

  const overflow: OverflowAction[] = status.connected
    ? [
        {
          id: "disconnect",
          label: "Disconnect Xero",
          icon: Unplug,
          tone: "danger",
          onSelect: () => setConfirming(true),
        },
      ]
    : [];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        breadcrumbs={
          <StaffBreadcrumbs
            items={[{ label: "Finance", href: "/admin/finance" }, { label: "Xero" }]}
          />
        }
        title="Xero"
        status={<StatusBadge tone={health.tone}>{health.label}</StatusBadge>}
        description={
          status.connected && status.tenantName
            ? `Invoices and payments sync with ${status.tenantName}.`
            : "Connect one Xero organisation for hosted invoices and payment collection."
        }
        {...(status.oauthConfigured && (!status.connected || needsReconnect)
          ? {
              primaryAction: (
                <form action={oauthStartAction}>
                  <StaffButton type="submit" variant="primary">
                    {status.connected ? "Reconnect Xero" : "Connect Xero"}
                  </StaffButton>
                </form>
              ),
            }
          : {})}
        {...(status.oauthConfigured && status.connected && !needsReconnect
          ? {
              secondaryActions: (
                <form action={oauthStartAction}>
                  <StaffButton type="submit">Reconnect Xero</StaffButton>
                </form>
              ),
            }
          : {})}
        {...(overflow.length > 0
          ? { overflow: <OverflowMenu actions={overflow} label="More actions for Xero" /> }
          : {})}
      />

      {notice}

      {status.connectionStatus === "needs_reauth" ? (
        <Notice tone="danger" title="Xero stopped accepting Bid's access">
          {status.lastRefreshError ?? "Reconnect Xero so invoices and payments sync again."}
        </Notice>
      ) : null}
      {!status.oauthConfigured ? (
        <Notice tone="info" title="Xero sign-in is not set up here">
          Ask your platform administrator to configure it for this environment.
        </Notice>
      ) : null}

      {status.connected ? (
        <Section
          title="Connection"
          description="Access renews by itself about every 30 minutes. Reconnect only if sync fails or access is revoked."
        >
          <KeyValueList items={connection} columns={2} />
        </Section>
      ) : null}

      <Section
        title="Webhooks"
        description={
          status.webhookUrl ? (
            <>
              Register the URL in the Xero organisation's webhook settings.{" "}
              <TextLink
                href="https://developer.xero.com/documentation/guides/webhooks/overview/"
                external
              >
                Xero webhook guide
              </TextLink>
            </>
          ) : undefined
        }
      >
        <KeyValueList items={webhooks} />
      </Section>

      <form ref={disconnectForm} action={disconnectAction} hidden />
      <ConfirmActionDialog
        open={confirming}
        onOpenChange={(open) => {
          if (!disconnecting) setConfirming(open);
        }}
        title="Disconnect Xero?"
        description="Hosted invoices and payment sync stop until someone connects Xero again."
        confirmLabel="Disconnect Xero"
        cancelLabel="Keep connected"
        tone="danger"
        loading={disconnecting}
        onConfirm={() => startDisconnect(() => disconnectForm.current?.requestSubmit())}
      />
    </div>
  );
}
