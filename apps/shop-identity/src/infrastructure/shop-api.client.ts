import { LAX_RESOURCES } from "@auction/identity-contracts";
import { ShopIdentityUpstreamError } from "../errors/shop-identity-upstream.error.js";

const UPSTREAM_FETCH_TIMEOUT_MS = 15_000;

const TOKEN_EXCHANGE_GRANT = "urn:ietf:params:oauth:grant-type:token-exchange";
const ID_TOKEN_TYPE = "urn:ietf:params:oauth:token-type:id_token";
const ACCESS_TOKEN_TYPE = "urn:ietf:params:oauth:token-type:access_token";

export type ShopApiClientOptions = {
  baseUrl: string;
  bffToken: string;
  tokenEndpoint: string;
  clientId: string;
  clientSecret: string;
};

type CachedResourceToken = { token: string; expiresAt: number; scopes: string };

const resourceTokenCache = new Map<string, CachedResourceToken>();

function cacheKey(sessionId: string, scopes: string): string {
  return `${sessionId}:${scopes}`;
}

export function clearResourceTokenCacheForSession(sessionId: string): void {
  for (const key of resourceTokenCache.keys()) {
    if (key.startsWith(`${sessionId}:`)) {
      resourceTokenCache.delete(key);
    }
  }
}

async function tokenRequest(
  tokenEndpoint: string,
  clientId: string,
  clientSecret: string,
  body: URLSearchParams,
): Promise<{ access_token: string; expires_in: number }> {
  let response: Response;
  try {
    response = await fetch(tokenEndpoint, {
      method: "POST",
      headers: {
        authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
        "content-type": "application/x-www-form-urlencoded",
        accept: "application/json",
      },
      body,
      signal: AbortSignal.timeout(UPSTREAM_FETCH_TIMEOUT_MS),
    });
  } catch (cause) {
    throw new ShopIdentityUpstreamError(
      cause instanceof Error ? cause.message : "Token exchange request failed",
      "oidc_token_exchange",
    );
  }
  if (!response.ok) {
    throw new ShopIdentityUpstreamError(
      `Shop API token exchange failed (${response.status})`,
      "oidc_token_exchange",
      response.status,
    );
  }
  const json = (await response.json()) as {
    access_token?: string;
    expires_in?: number;
  };
  if (typeof json.access_token !== "string" || typeof json.expires_in !== "number") {
    throw new ShopIdentityUpstreamError("Invalid token exchange response", "oidc_token_exchange");
  }
  return { access_token: json.access_token, expires_in: json.expires_in };
}

export async function resolveShopApiBearerToken(
  options: ShopApiClientOptions,
  input: { sessionId: string; idToken: string | null; scopes: "shop.read" | "shop.write" },
): Promise<string> {
  if (!input.idToken) {
    if (!options.bffToken) {
      throw new ShopIdentityUpstreamError("Shop API BFF token is not configured", "configuration");
    }
    return options.bffToken;
  }
  {
    const key = cacheKey(input.sessionId, input.scopes);
    const cached = resourceTokenCache.get(key);
    if (cached && cached.expiresAt > Date.now() + 30_000) {
      return cached.token;
    }
    const exchanged = await tokenRequest(
      options.tokenEndpoint,
      options.clientId,
      options.clientSecret,
      new URLSearchParams({
        grant_type: TOKEN_EXCHANGE_GRANT,
        subject_token: input.idToken,
        subject_token_type: ID_TOKEN_TYPE,
        requested_token_type: ACCESS_TOKEN_TYPE,
        resource: LAX_RESOURCES["lax-shop-api"].uri,
        scope: input.scopes,
      }),
    );
    resourceTokenCache.set(key, {
      token: exchanged.access_token,
      expiresAt: Date.now() + exchanged.expires_in * 1_000,
      scopes: input.scopes,
    });
    return exchanged.access_token;
  }
}

export async function shopApiFetch(
  options: ShopApiClientOptions,
  input: {
    sessionId: string;
    idToken: string | null;
    scopes: "shop.read" | "shop.write";
    path: string;
    method: string;
    basketToken?: string | null;
    body?: unknown;
    idempotencyKey?: string;
  },
): Promise<Response> {
  const bearer = await resolveShopApiBearerToken(options, {
    sessionId: input.sessionId,
    idToken: input.idToken,
    scopes: input.scopes,
  });
  const url = `${options.baseUrl.replace(/\/+$/, "")}${input.path.startsWith("/") ? input.path : `/${input.path}`}`;
  const headers: Record<string, string> = {
    accept: "application/json",
    authorization: `Bearer ${bearer}`,
  };
  if (input.basketToken) {
    headers["x-shop-basket-token"] = input.basketToken;
  }
  if (input.idempotencyKey) {
    headers["idempotency-key"] = input.idempotencyKey;
  }
  if (input.body !== undefined) {
    headers["content-type"] = "application/json";
  }
  try {
    return await fetch(url, {
      method: input.method,
      headers,
      ...(input.body !== undefined ? { body: JSON.stringify(input.body) } : {}),
      signal: AbortSignal.timeout(UPSTREAM_FETCH_TIMEOUT_MS),
    });
  } catch (cause) {
    throw new ShopIdentityUpstreamError(
      cause instanceof Error ? cause.message : "Shop API request failed",
      "shop_api_fetch",
    );
  }
}
