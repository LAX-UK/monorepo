import { SUBJECT_EXPORT_MACHINE_SCOPE } from "@auction/identity-contracts";
import { transientError } from "./subject-export.errors.js";

/** How the worker proves itself to one party. */
export interface ExportRequestAuth {
  headers(signal: AbortSignal): Promise<Record<string, string>>;
  /** The party refused the credential; a cached one should not be used again. */
  rejected(): void;
}

/**
 * Bid and Shop take the export client pair in headers, with the scope named. Their routes accept
 * only this pair and this scope, so the deletion-eligibility credential cannot read personal data.
 */
export class ClientPairAuth implements ExportRequestAuth {
  constructor(
    private readonly clientId: string,
    private readonly clientSecret: string,
  ) {}

  async headers(): Promise<Record<string, string>> {
    return {
      "x-identity-client-id": this.clientId,
      "x-identity-client-secret": this.clientSecret,
      "x-identity-client-scope": SUBJECT_EXPORT_MACHINE_SCOPE,
    };
  }

  rejected(): void {}
}

export type IdentityBearerAuthConfig = {
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  fetchImpl?: typeof fetch;
  now?: () => number;
};

const TOKEN_REFRESH_MARGIN_MS = 10_000;

/**
 * Identity takes an OAuth bearer from `/internal/oauth/token` for the separate `subject_export`
 * client. The token is cached until shortly before it expires.
 */
export class IdentityBearerAuth implements ExportRequestAuth {
  private cached: { value: string; expiresAt: number } | null = null;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly now: () => number;

  constructor(private readonly config: IdentityBearerAuthConfig) {
    this.baseUrl = config.baseUrl.replace(/\/+$/, "");
    this.fetchImpl = config.fetchImpl ?? fetch;
    this.now = config.now ?? Date.now;
  }

  async headers(signal: AbortSignal): Promise<Record<string, string>> {
    return { authorization: `Bearer ${await this.token(signal)}` };
  }

  rejected(): void {
    this.cached = null;
  }

  private async token(signal: AbortSignal): Promise<string> {
    if (this.cached && this.cached.expiresAt > this.now() + TOKEN_REFRESH_MARGIN_MS) {
      return this.cached.value;
    }
    const { clientId, clientSecret } = this.config;
    let response: Response;
    try {
      response = await this.fetchImpl(`${this.baseUrl}/internal/oauth/token`, {
        method: "POST",
        headers: {
          accept: "application/json",
          authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
          "content-type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          grant_type: "client_credentials",
          scope: SUBJECT_EXPORT_MACHINE_SCOPE,
        }),
        signal,
      });
    } catch (error) {
      throw transientError("identity_unreachable", undefined, error);
    }
    const body = (await response.json().catch(() => null)) as {
      access_token?: unknown;
      expires_in?: unknown;
    } | null;
    if (
      !response.ok ||
      typeof body?.access_token !== "string" ||
      typeof body.expires_in !== "number"
    ) {
      // A refused credential is a configuration problem a person can fix within the retry window.
      throw transientError(`identity_token_${response.status}`);
    }
    this.cached = {
      value: body.access_token,
      expiresAt: this.now() + body.expires_in * 1000,
    };
    return body.access_token;
  }
}
