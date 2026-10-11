/**
 * Narrow structural views of the Stripe SDK used by Connect adapters. Typed
 * independently of any `stripe` package version so each platform's
 * composition root can inject its own client (Bid and LAX Art pin different
 * SDK majors).
 */

export type ConnectRequestOptions = { idempotencyKey?: string };

export type ConnectAccountLinkCreateParams = {
  account: string;
  type: "account_onboarding";
  return_url: string;
  refresh_url: string;
};

export interface ConnectAccountLinksClient {
  accountLinks: {
    create(params: ConnectAccountLinkCreateParams): Promise<{ url: string; expires_at: number }>;
  };
}

export type ConnectAccountSessionComponents = {
  account_onboarding?: { enabled: boolean };
  account_management?: {
    enabled: boolean;
    features?: { external_account_collection?: boolean };
  };
  notification_banner?: { enabled: boolean };
  balances?: { enabled: boolean };
};

export interface ConnectAccountSessionsClient {
  accountSessions: {
    create(params: {
      account: string;
      components: ConnectAccountSessionComponents;
    }): Promise<{ client_secret: string | null }>;
  };
}

export type ConnectTransferCreateParams = {
  amount: number;
  currency: string;
  destination: string;
  transfer_group?: string;
  source_transaction?: string;
  metadata?: Record<string, string>;
};

export interface ConnectTransfersClient {
  transfers: {
    create(
      params: ConnectTransferCreateParams,
      options?: ConnectRequestOptions,
    ): Promise<{ id: string }>;
  };
}
