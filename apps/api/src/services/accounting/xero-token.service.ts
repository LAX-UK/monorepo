import type { Redis } from "ioredis";
import { XeroClient } from "xero-node";
import type { Env } from "../../env.js";
import type { IErrorReporter } from "../interfaces/error-handling.js";
import type {
  IXeroConnectionRepository,
  XeroConnectionRow,
} from "../interfaces/xero-repositories.js";
import { applyStoredTokens, refreshXeroTokensIfNeeded } from "./xero-auth-runtime.js";

/** Granular Accounting scopes (required for Xero apps created on/after 2026-03-02). */
const XERO_SCOPES = [
  "openid",
  "profile",
  "email",
  "offline_access",
  "accounting.settings",
  "accounting.contacts",
  "accounting.invoices",
  "accounting.invoices.read",
  "accounting.payments",
];

export type XeroEnvConfig = Pick<
  Env,
  "XERO_CLIENT_ID" | "XERO_CLIENT_SECRET" | "XERO_REDIRECT_URI"
>;

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

/** Scopes used for Xero OAuth (exported for OAuth service). */
export function getXeroScopes(): string[] {
  return [...XERO_SCOPES];
}

export function createXeroClientForOAuth(env: XeroEnvConfig, state?: string): XeroClient {
  const cfg: ConstructorParameters<typeof XeroClient>[0] = {
    clientId: env.XERO_CLIENT_ID as string,
    clientSecret: env.XERO_CLIENT_SECRET as string,
    redirectUris: [env.XERO_REDIRECT_URI as string],
    scopes: XERO_SCOPES,
  };
  if (state !== undefined) {
    cfg.state = state;
  }
  return new XeroClient(cfg);
}
