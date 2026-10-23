import {
  ACCOUNT_SECURITY_FACTS_PATH,
  type AccountSecurityFactsResponse,
  REGISTERED_OIDC_CLIENT_IDS,
  type RegisteredOidcClientId,
} from "@auction/identity-contracts";
import { type Context, Hono } from "hono";
import type { TokenIntrospection } from "../services/oauth-token-management.service.js";
import { authenticateConfidentialClient } from "./oauth-client-auth.js";
import type { ConfidentialClientAuthenticator } from "./token-exchange.routes.js";

export type AccountSecurityFactsRouteDeps = {
  clients: ConfidentialClientAuthenticator;
  tokens: {
    introspect(input: {
      requesterClientId: RegisteredOidcClientId;
      token: string;
      tokenTypeHint: "access_token";
    }): Promise<TokenIntrospection>;
  };
  facts: { read(subjectId: string): Promise<AccountSecurityFactsResponse | null> };
  /** Seconds to wait when the subject is over its budget, otherwise null. */
  rateLimit(subjectId: string): Promise<number | null>;
  onReadFailure?: (error: unknown) => void;
};

function noStore(c: Context): void {
  c.header("Cache-Control", "no-store");
  c.header("Pragma", "no-cache");
}

/**
 * Lets LAX Account read the signed-in person's own security state (is two-step verification
 * on, how many backup codes are left).
 *
 * Why a client-authenticated route rather than ID-token claims: the answer must be live. An
 * ID token is minted at sign-in, so a person who turns two-step verification on afterwards
 * would keep seeing "Off" in Account until they signed in again.
 *
 * Authorisation: the caller proves it is LAX Account with its client secret, and the subject
 * comes only from that client's own active access token. No request field names a subject, so
 * one person's token can never read another person's facts. Other clients are refused even
 * with a valid secret and token.
 */
export function createAccountSecurityFactsRoutes(deps: AccountSecurityFactsRouteDeps) {
  const app = new Hono();

  app.post(ACCOUNT_SECURITY_FACTS_PATH, async (c) => {
    noStore(c);
    if (!(c.req.header("content-type") ?? "").includes("application/x-www-form-urlencoded")) {
      return c.json({ error: "invalid_request" }, 400);
    }
    const params = new URLSearchParams(await c.req.text());
    if (params.getAll("token").length !== 1) return c.json({ error: "invalid_request" }, 400);

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

    const introspection = await deps.tokens.introspect({
      requesterClientId: clientId,
      token: params.get("token") ?? "",
      tokenTypeHint: "access_token",
    });
    if (!introspection.active) return c.json({ error: "invalid_token" }, 401);

    const retryAfterSec = await deps.rateLimit(introspection.sub);
    if (retryAfterSec !== null) {
      c.header("Retry-After", String(retryAfterSec));
      return c.json({ error: "rate_limited" }, 429);
    }

    try {
      const facts = await deps.facts.read(introspection.sub);
      if (!facts) return c.json({ error: "invalid_token" }, 401);
      // Picked field by field so a future reader that returns more can never widen the response.
      return c.json({
        twoFactorEnabled: facts.twoFactorEnabled,
        backupCodesRemaining: facts.backupCodesRemaining,
      });
    } catch (error) {
      deps.onReadFailure?.(error);
      return c.json({ error: "temporarily_unavailable" }, 503);
    }
  });

  return app;
}
