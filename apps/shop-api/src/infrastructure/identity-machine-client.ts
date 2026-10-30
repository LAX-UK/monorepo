const REQUEST_TIMEOUT_MS = 3_000;
/** Identity's machine routes accept one scope. */
const MACHINE_SCOPE = "identity.lifecycle";

export type IdentityMachineClientConfig = {
  /** Identity's base URL (the private one where there is one). */
  issuerBaseUrl: string;
  clientId: string;
  clientSecret: string;
  fetchImpl?: typeof fetch;
};

export type IdentityMachineClient = {
  /** Calls `/internal<path>` with a cached client-credentials token; throws on a non-2xx answer. */
  request(method: "GET" | "POST", path: string, body?: unknown): Promise<unknown>;
};

/**
 * Service-to-service calls to Identity's `/internal/identity/*` routes. The token is cached until
 * shortly before it expires and fetched again once if Identity rejects it.
 */
export function createIdentityMachineClient(
  config: IdentityMachineClientConfig,
): IdentityMachineClient {
  const base = config.issuerBaseUrl.replace(/\/+$/, "");
  const fetchImpl = config.fetchImpl ?? fetch;
  let token: { value: string; expiresAt: number } | null = null;

  async function machineToken(): Promise<string> {
    if (token && token.expiresAt > Date.now() + 10_000) return token.value;
    const response = await fetchImpl(`${base}/internal/oauth/token`, {
      method: "POST",
      headers: {
        accept: "application/json",
        authorization: `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64")}`,
        "content-type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ grant_type: "client_credentials", scope: MACHINE_SCOPE }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    const body = (await response.json().catch(() => null)) as {
      access_token?: unknown;
      expires_in?: unknown;
    } | null;
    if (
      !response.ok ||
      typeof body?.access_token !== "string" ||
      typeof body.expires_in !== "number"
    ) {
      throw new Error(`Identity machine token request responded ${response.status}`);
    }
    token = { value: body.access_token, expiresAt: Date.now() + body.expires_in * 1000 };
    return token.value;
  }

  async function request(
    method: "GET" | "POST",
    path: string,
    body?: unknown,
    retry = true,
  ): Promise<unknown> {
    const response = await fetchImpl(`${base}/internal${path}`, {
      method,
      headers: {
        accept: "application/json",
        authorization: `Bearer ${await machineToken()}`,
        ...(body ? { "content-type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (response.status === 401 && retry) {
      token = null;
      return request(method, path, body, false);
    }
    if (!response.ok) {
      throw new Error(`Identity ${path} responded ${response.status}`);
    }
    return response.json();
  }

  return { request: (method, path, body) => request(method, path, body) };
}
