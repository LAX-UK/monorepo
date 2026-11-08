import type {
  ConnectAccountLinksClient,
  ConnectAccountSessionComponents,
  ConnectAccountSessionsClient,
  ConnectRequestOptions,
  ConnectTransfersClient,
} from "./connect-stripe-client.js";

/**
 * Controller for platform-collected Custom accounts rendered through embedded
 * components: the platform pays fees, owns losses and collects requirements;
 * the connected account has no Stripe dashboard.
 */
export function platformCollectedConnectController() {
  return {
    fees: { payer: "application" as const },
    losses: { payments: "application" as const },
    requirement_collection: "application" as const,
    stripe_dashboard: { type: "none" as const },
  };
}

export type ConnectSessionSurface = "onboarding" | "management";

export function connectSessionComponents(
  surface: ConnectSessionSurface,
): ConnectAccountSessionComponents {
  if (surface === "onboarding") {
    return {
      account_onboarding: { enabled: true },
      notification_banner: { enabled: true },
    };
  }
  return {
    account_management: {
      enabled: true,
      features: { external_account_collection: true },
    },
    notification_banner: { enabled: true },
    balances: { enabled: true },
  };
}

/** Returns null when Stripe omits the client secret; callers map that to their own error. */
export async function createConnectAccountSession(
  client: ConnectAccountSessionsClient,
  input: { accountId: string; components: ConnectAccountSessionComponents },
): Promise<string | null> {
  const session = await client.accountSessions.create({
    account: input.accountId,
    components: input.components,
  });
  return session.client_secret ?? null;
}

export type ConnectOnboardingLink = { url: string; expiresAt: Date };

export async function createConnectOnboardingLink(
  client: ConnectAccountLinksClient,
  input: { accountId: string; returnUrl: string; refreshUrl: string },
): Promise<ConnectOnboardingLink> {
  const link = await client.accountLinks.create({
    account: input.accountId,
    type: "account_onboarding",
    return_url: input.returnUrl,
    refresh_url: input.refreshUrl,
  });
  return { url: link.url, expiresAt: new Date(link.expires_at * 1000) };
}

export type ConnectTransferInput = {
  amountMinor: number;
  currency: string;
  destinationAccountId: string;
  transferGroup: string;
  sourceChargeId?: string;
  metadata: Record<string, string>;
  idempotencyKey: string;
};

export async function createConnectTransfer(
  client: ConnectTransfersClient,
  input: ConnectTransferInput,
): Promise<{ id: string }> {
  const options: ConnectRequestOptions = { idempotencyKey: input.idempotencyKey };
  return client.transfers.create(
    {
      amount: input.amountMinor,
      currency: input.currency.toLowerCase(),
      destination: input.destinationAccountId,
      transfer_group: input.transferGroup,
      ...(input.sourceChargeId ? { source_transaction: input.sourceChargeId } : {}),
      metadata: input.metadata,
    },
    options,
  );
}
