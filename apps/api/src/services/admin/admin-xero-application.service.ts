import { isXeroCallbackUrlAllowed } from "@auction/validators";
import type {
  IXeroAdminApplicationService,
  XeroStatusPayload,
} from "../interfaces/admin-routes.js";
import type { XeroOAuthService } from "../xero-oauth.service.js";

export class AdminXeroApplicationService implements IXeroAdminApplicationService {
  constructor(
    private readonly xeroOAuth: XeroOAuthService | null,
    private readonly xeroRedirectUri: string | undefined,
  ) {}

  async getStatusPayload(): Promise<XeroStatusPayload> {
    if (!this.xeroOAuth) {
      return {
        connected: false,
        tenantId: null,
        tenantName: null,
        expiresAt: null,
        oauthConfigured: false,
      };
    }
    const data = await this.xeroOAuth.getConnectionSummary();
    return { ...data, oauthConfigured: true };
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
    if (!allowed || !isXeroCallbackUrlAllowed(input.callbackFullUrl, allowed)) {
      return { ok: false, message: "Invalid callback URL" };
    }
    const result = await this.xeroOAuth.completeOAuth({
      userId: input.userId,
      state: input.state,
      callbackFullUrl: input.callbackFullUrl,
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
