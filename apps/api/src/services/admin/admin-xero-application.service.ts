import type { IUserRepository } from "@auction/persistence";
import type {
  IPaymentExternalRefRepository,
  IXeroConnectionRepository,
  IXeroWebhookEventRepository,
} from "@auction/persistence";
import { canonicalizeXeroCallbackUrl } from "@auction/validators";
import type { Env } from "../../env.js";
import type {
  IXeroAdminApplicationService,
  XeroConnectionHealth,
  XeroStatusPayload,
} from "../interfaces/admin-routes.js";
import type { XeroOAuthService } from "../xero-oauth.service.js";

const WEBHOOK_ERROR_WINDOW_MS = 24 * 60 * 60 * 1000;

function disconnectedPayload(oauthConfigured: boolean): XeroStatusPayload {
  return {
    connected: false,
    tenantId: null,
    tenantName: null,
    expiresAt: null,
    oauthConfigured,
    connectedAt: null,
    updatedAt: null,
    connectedBy: null,
    scopes: null,
    webhookConfigured: false,
    webhookUrl: null,
    recentWebhookErrors: 0,
    syncErrorCount: 0,
    health: "disconnected",
    connectionStatus: null,
    lastRefreshError: null,
    orgShortCode: null,
    orgBaseCurrency: null,
  };
}

function deriveHealth(input: {
  connected: boolean;
  connectionStatus: "healthy" | "needs_reauth" | null;
  syncErrorCount: number;
  recentWebhookErrors: number;
}): XeroConnectionHealth {
  if (!input.connected) return "disconnected";
  if (
    input.connectionStatus === "needs_reauth" ||
    input.syncErrorCount > 0 ||
    input.recentWebhookErrors > 0
  ) {
    return "degraded";
  }
  return "healthy";
}

export class AdminXeroApplicationService implements IXeroAdminApplicationService {
  constructor(
    private readonly xeroOAuth: XeroOAuthService | null,
    private readonly xeroRedirectUri: string | undefined,
    private readonly connections: IXeroConnectionRepository,
    private readonly webhookEvents: IXeroWebhookEventRepository,
    private readonly externalRefs: IPaymentExternalRefRepository,
    private readonly users: IUserRepository,
    private readonly env: Pick<Env, "API_PUBLIC_URL" | "XERO_WEBHOOK_KEY">,
  ) {}

  async getStatusPayload(): Promise<XeroStatusPayload> {
    const webhookUrl = `${this.env.API_PUBLIC_URL.replace(/\/$/, "")}/webhooks/xero`;
    const webhookConfigured = Boolean(this.env.XERO_WEBHOOK_KEY);

    if (!this.xeroOAuth) {
      return {
        ...disconnectedPayload(false),
        webhookUrl,
        webhookConfigured,
      };
    }

    const row = await this.connections.findLatest();
    if (!row) {
      return {
        ...disconnectedPayload(true),
        webhookUrl,
        webhookConfigured,
      };
    }

    const since = new Date(Date.now() - WEBHOOK_ERROR_WINDOW_MS);
    const [recentWebhookErrors, syncErrorCount] = await Promise.all([
      this.webhookEvents.countErrorsSince(since),
      this.externalRefs.countSyncErrors(),
    ]);

    let connectedBy: XeroStatusPayload["connectedBy"] = null;
    if (row.connectedByUserId) {
      const user = await this.users.findById(row.connectedByUserId);
      if (user) {
        connectedBy = { id: user.id, name: user.name, email: user.email };
      }
    }

    const connectionStatus = row.connectionStatus;
    const health = deriveHealth({
      connected: true,
      connectionStatus,
      syncErrorCount,
      recentWebhookErrors,
    });

    return {
      connected: true,
      tenantId: row.tenantId,
      tenantName: row.tenantName ?? null,
      expiresAt: row.expiresAt.toISOString(),
      oauthConfigured: true,
      connectedAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      connectedBy,
      scopes: row.scopes ?? null,
      webhookConfigured,
      webhookUrl,
      recentWebhookErrors,
      syncErrorCount,
      health,
      connectionStatus,
      lastRefreshError: row.lastRefreshError ?? null,
      orgShortCode: row.orgShortCode ?? null,
      orgBaseCurrency: row.orgBaseCurrency ?? null,
    };
  }

  async buildConsentUrl(
    userId: string,
  ): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
    if (!this.xeroOAuth) {
      return { ok: false, error: "Xero not configured" };
    }
    const url = await this.xeroOAuth.buildConsentUrlForUser(userId);
    return { ok: true, url };
  }

  async completeOAuth(input: {
    userId: string;
    state: string;
    callbackFullUrl: string;
  }): Promise<{ ok: true } | { ok: false; message: string }> {
    if (!this.xeroOAuth) {
      return { ok: false, message: "Xero not configured" };
    }
    const allowed = this.xeroRedirectUri;
    const callbackFullUrl =
      allowed != null ? canonicalizeXeroCallbackUrl(input.callbackFullUrl, allowed) : null;
    if (!callbackFullUrl) {
      return { ok: false, message: "Invalid callback URL" };
    }
    const result = await this.xeroOAuth.completeOAuth({
      userId: input.userId,
      state: input.state,
      callbackFullUrl,
    });
    if (!result.ok) {
      return { ok: false, message: result.message };
    }
    return { ok: true };
  }

  async disconnect(): Promise<{ ok: true } | { ok: false; error: string }> {
    if (!this.xeroOAuth) {
      return { ok: false, error: "Xero not configured" };
    }
    await this.xeroOAuth.disconnect();
    return { ok: true };
  }
}
