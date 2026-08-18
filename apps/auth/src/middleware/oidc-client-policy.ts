import {
  AUTH_ROUTE_PATH,
  type IdentityScope,
  REGISTERED_OIDC_CLIENTS,
  type RegisteredOidcClientId,
} from "@auction/identity-contracts";
import type { MiddlewareHandler } from "hono";

export type OidcAuthorizationPolicyError =
  | "invalid_client"
  | "invalid_redirect_uri"
  | "invalid_response_type"
  | "invalid_scope"
  | "invalid_pkce";

export function validateOidcAuthorizationRequest(
  params: URLSearchParams,
): OidcAuthorizationPolicyError | null {
  const clientId = params.get("client_id") as RegisteredOidcClientId | null;
  if (!clientId || !(clientId in REGISTERED_OIDC_CLIENTS)) return "invalid_client";

  const client = REGISTERED_OIDC_CLIENTS[clientId];
  const redirectUri = params.get("redirect_uri");
  if (!redirectUri || !client.redirectUris.includes(redirectUri)) return "invalid_redirect_uri";
  if (params.get("response_type") !== "code") return "invalid_response_type";

  const requestedScopes = (params.get("scope") ?? "openid")
    .split(/\s+/)
    .filter(Boolean) as IdentityScope[];
  if (
    !requestedScopes.includes("openid") ||
    requestedScopes.some((scope) => !client.allowedScopes.includes(scope))
  ) {
    return "invalid_scope";
  }

  if (
    client.pkceRequired &&
    (params.get("code_challenge_method") !== "S256" || !params.get("code_challenge"))
  ) {
    return "invalid_pkce";
  }

  return null;
}

/** Enforces the repository-owned allowlist before Better Auth handles OIDC requests. */
export function createOidcClientPolicyMiddleware(): MiddlewareHandler {
  return async (c, next) => {
    const path = new URL(c.req.url).pathname.replace(/\/+$/, "");
    if (path === `${AUTH_ROUTE_PATH}/oauth2/register`) {
      return c.json({ error: "not_found" }, 404);
    }
    if (path !== `${AUTH_ROUTE_PATH}/oauth2/authorize`) {
      await next();
      return;
    }

    const params = new URL(c.req.url).searchParams;
    const error = validateOidcAuthorizationRequest(params);
    if (error) {
      const redirectUri = params.get("redirect_uri");
      if (redirectUri && error !== "invalid_client" && error !== "invalid_redirect_uri") {
        const redirect = new URL(redirectUri);
        redirect.searchParams.set("error", error === "invalid_pkce" ? "invalid_request" : error);
        const state = params.get("state");
        if (state) redirect.searchParams.set("state", state);
        return c.redirect(redirect.toString(), 302);
      }
      return c.json({ error }, 400);
    }
    await next();
  };
}
