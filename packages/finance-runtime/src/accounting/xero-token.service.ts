import type { IXeroConnectionRepository, XeroConnectionRow } from "@auction/persistence/interfaces";
import type { Redis } from "ioredis";
import type { XeroClient } from "xero-node";
import type { IErrorReporter } from "../interfaces/error-handling.js";
import { applyStoredTokens, refreshXeroTokensIfNeeded } from "./xero-auth-runtime.js";
import { type XeroEnvConfig, createXeroClientForOAuth } from "./xero-client-factory.js";

export type { XeroEnvConfig } from "./xero-client-factory.js";
export { createXeroClientForOAuth, getXeroScopes } from "./xero-client-factory.js";

export class XeroTokenService {
  constructor(
    private readonly env: XeroEnvConfig,
    private readonly connections: IXeroConnectionRepository,
    private readonly errorReporter: IErrorReporter,
    private readonly redis: Redis,
  ) {}

  isConfigured(): boolean {
    return Boolean(
      this.env.XERO_CLIENT_ID && this.env.XERO_CLIENT_SECRET && this.env.XERO_REDIRECT_URI,
    );
  }

  baseClient(state?: string): XeroClient {
    return createXeroClientForOAuth(this.env, state);
  }

  async refreshXeroTokensReporting(
    xero: XeroClient,
    conn: XeroConnectionRow,
  ): Promise<XeroConnectionRow> {
    try {
      return await refreshXeroTokensIfNeeded(xero, this.connections, conn, {
        redis: this.redis,
      });
    } catch (cause) {
      this.errorReporter.report({
        severity: "error",
        code: "xero_refresh_failed",
        message: "Xero OAuth token refresh failed",
        status: 502,
        cause,
      });
      throw cause;
    }
  }

  async initializeAuthenticatedClient(
    conn: XeroConnectionRow,
  ): Promise<{ xero: XeroClient; tenantId: string }> {
    const xero = this.baseClient();
    await xero.initialize();
    await applyStoredTokens(xero, conn);
    const liveConn = await this.refreshXeroTokensReporting(xero, conn);
    return { xero, tenantId: liveConn.tenantId };
  }
}
