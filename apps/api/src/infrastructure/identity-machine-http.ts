import { DataRequestsUnavailableError } from "../services/interfaces/identity-data-requests-client.js";

const DEFAULT_TIMEOUT_MS = 5_000;

export type MachineHttpResponse = { status: number; body: unknown };

/**
 * Calls Identity's internal routes with a machine credential of one scope. The token is cached
 * until shortly before it expires and fetched again after a 401. A response with any status is
 * returned as is, so the caller can tell a business refusal from an outage; only a network
 * failure, a timeout or a failed token request throws.
 */
export class IdentityMachineHttp {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;
  private token: { value: string; expiresAt: number } | null = null;

  constructor(
    private readonly options: {
      issuerBaseUrl: string;
      scope: string;
      clientId?: string | undefined;
      clientSecret?: string | undefined;
      fetchImpl?: typeof fetch;
      timeoutMs?: number;
    },
  ) {
    this.baseUrl = options.issuerBaseUrl.replace(/\/+$/, "");
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  async request(
    method: "GET" | "POST" | "PATCH",
    path: string,
    body?: unknown,
    retry = true,
  ): Promise<MachineHttpResponse> {
    const token = await this.accessToken();
    const response = await this.send(`${this.baseUrl}/internal${path}`, {
      method,
      headers: {
        accept: "application/json",
        authorization: `Bearer ${token}`,
        ...(body !== undefined ? { "content-type": "application/json" } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    if (response.status === 401 && retry) {
      this.token = null;
      return this.request(method, path, body, false);
    }
    return { status: response.status, body: await readJson(response) };
  }

  private async accessToken(): Promise<string> {
    if (this.token && this.token.expiresAt > Date.now() + 10_000) return this.token.value;
    const { clientId, clientSecret, scope } = this.options;
    if (!clientId || !clientSecret) {
      throw new DataRequestsUnavailableError(
        "Identity data requests credentials are not configured",
      );
    }
    const response = await this.send(`${this.baseUrl}/internal/oauth/token`, {
      method: "POST",
      headers: {
        accept: "application/json",
        authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
        "content-type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ grant_type: "client_credentials", scope }),
    });
    const body = (await readJson(response)) as
      | { access_token?: unknown; expires_in?: unknown }
      | undefined;
    if (
      !response.ok ||
      typeof body?.access_token !== "string" ||
      typeof body.expires_in !== "number"
    ) {
      throw new DataRequestsUnavailableError("Identity data requests token request failed");
    }
    this.token = { value: body.access_token, expiresAt: Date.now() + body.expires_in * 1000 };
    return body.access_token;
  }

  private async send(url: string, init: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      return await this.fetchImpl(url, { ...init, signal: controller.signal });
    } catch (error) {
      throw new DataRequestsUnavailableError(
        controller.signal.aborted
          ? "Identity data requests request timed out"
          : error instanceof Error
            ? error.message
            : "Identity data requests request failed",
      );
    } finally {
      clearTimeout(timeout);
    }
  }
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}
