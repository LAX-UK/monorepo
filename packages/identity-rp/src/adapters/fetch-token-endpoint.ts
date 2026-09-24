import { IdentityUnavailableError, throwTokenEndpointFailure } from "../errors.js";
import type { TokenEndpoint } from "../ports/token-endpoint.js";
import { parseBearerTokenResponse } from "../token-codec.js";

export type FetchTokenEndpointAuth =
  | { kind: "basic"; clientId: string; clientSecret: string }
  | { kind: "body"; clientId: string; clientSecret: string };

async function readOAuthErrorFromResponse(response: Response): Promise<string | undefined> {
  try {
    const text = await response.text();
    try {
      const parsed = JSON.parse(text) as { error?: unknown };
      return typeof parsed.error === "string" ? parsed.error : undefined;
    } catch {
      return undefined;
    }
  } catch {
    return undefined;
  }
}

export function createFetchTokenEndpoint(input: {
  tokenEndpointUrl: string;
  auth: FetchTokenEndpointAuth;
  timeoutMs: number;
  fetchImpl?: typeof fetch;
}): TokenEndpoint {
  const fetchFn = input.fetchImpl ?? fetch;
  return {
    async requestToken(
      body: URLSearchParams,
    ): Promise<ReturnType<typeof parseBearerTokenResponse>> {
      const headers: Record<string, string> = {
        "content-type": "application/x-www-form-urlencoded",
        accept: "application/json",
      };
      if (input.auth.kind === "basic") {
        headers.authorization = `Basic ${Buffer.from(`${input.auth.clientId}:${input.auth.clientSecret}`).toString("base64")}`;
      } else {
        body.set("client_id", input.auth.clientId);
        body.set("client_secret", input.auth.clientSecret);
      }
      let response: Response;
      try {
        response = await fetchFn(input.tokenEndpointUrl, {
          method: "POST",
          headers,
          body,
          signal: AbortSignal.timeout(input.timeoutMs),
        });
      } catch {
        throwTokenEndpointFailure(null, "Identity token endpoint is unavailable");
      }
      if (!response.ok) {
        const oauthError = await readOAuthErrorFromResponse(response);
        throwTokenEndpointFailure(
          response.status,
          `Identity token endpoint returned ${response.status}`,
          oauthError,
        );
      }
      let json: Parameters<typeof parseBearerTokenResponse>[1];
      try {
        json = (await response.json()) as Parameters<typeof parseBearerTokenResponse>[1];
      } catch {
        throw new IdentityUnavailableError("Identity token endpoint returned an invalid response");
      }
      return parseBearerTokenResponse(response.status, json);
    },
  };
}
