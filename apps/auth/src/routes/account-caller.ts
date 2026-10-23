import {
  REGISTERED_OIDC_CLIENT_IDS,
  type RegisteredOidcClientId,
} from "@auction/identity-contracts";
import type { Context } from "hono";
import type { TokenIntrospection } from "../services/oauth-token-management.service.js";
import { authenticateConfidentialClient } from "./oauth-client-auth.js";
import type { ConfidentialClientAuthenticator } from "./token-exchange.routes.js";

export type AccountCallerDeps = {
  clients: ConfidentialClientAuthenticator;
  tokens: {
    introspect(input: {
      requesterClientId: RegisteredOidcClientId;
      token: string;
      tokenTypeHint: "access_token";
    }): Promise<TokenIntrospection>;
  };
  /** Seconds to wait when the subject is over its budget, otherwise null. */
  rateLimit(subjectId: string): Promise<number | null>;
};

export function noStore(c: Context): void {
  c.header("Cache-Control", "no-store");
  c.header("Pragma", "no-cache");
}

/**
 * Proves a call comes from LAX Account itself (its client secret) and returns the parsed form
 * body, or the response to send. It says nothing about which person the call is for; use
 * authenticateAccountCaller for that. Calls that carry their own proof, such as an emailed
 * confirmation link, stop here.
 */
export async function authenticateAccountClient(
  c: Context,
  deps: Pick<AccountCallerDeps, "clients">,
): Promise<{ params: URLSearchParams } | Response> {
  noStore(c);
  if (!(c.req.header("content-type") ?? "").includes("application/x-www-form-urlencoded")) {
    return c.json({ error: "invalid_request" }, 400);
  }
  const params = new URLSearchParams(await c.req.text());
  const clientId = await authenticateConfidentialClient(
    deps.clients,
    c.req.header("authorization"),
    params,
  );
  if (!clientId) {
    c.header("WWW-Authenticate", 'Basic realm="oauth"');
    return c.json({ error: "invalid_client" }, 401);
  }
  if (clientId !== REGISTERED_OIDC_CLIENT_IDS.LAX_ACCOUNT_WEB) {
    return c.json({ error: "unauthorized_client" }, 403);
  }
  return { params };
}

/**
 * Authenticates a call from LAX Account and says whose data it may touch.
 *
 * The caller proves it is LAX Account with its client secret, and the subject comes only from
 * that client's own active access token. No request field names a subject, so one person's
 * token can never reach another person's data. Other clients are refused even with a valid
 * secret and token. Returns the parsed form body for the route's own fields, or the response
 * to send.
 */
export async function authenticateAccountCaller(
  c: Context,
  deps: AccountCallerDeps,
): Promise<{ subjectId: string; params: URLSearchParams } | Response> {
  const client = await authenticateAccountClient(c, deps);
  if (client instanceof Response) return client;
  const { params } = client;
  if (params.getAll("token").length !== 1) return c.json({ error: "invalid_request" }, 400);

  const introspection = await deps.tokens.introspect({
    requesterClientId: REGISTERED_OIDC_CLIENT_IDS.LAX_ACCOUNT_WEB,
    token: params.get("token") ?? "",
    tokenTypeHint: "access_token",
  });
  if (!introspection.active) return c.json({ error: "invalid_token" }, 401);

  const retryAfterSec = await deps.rateLimit(introspection.sub);
  if (retryAfterSec !== null) {
    c.header("Retry-After", String(retryAfterSec));
    return c.json({ error: "rate_limited" }, 429);
  }
  return { subjectId: introspection.sub, params };
}
