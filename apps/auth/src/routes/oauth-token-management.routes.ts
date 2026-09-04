import { type Context, Hono } from "hono";
import type { BackchannelLogoutService } from "../services/backchannel-logout.service.js";
import type { OauthTokenManagementService } from "../services/oauth-token-management.service.js";
import { authenticateConfidentialClient } from "./oauth-client-auth.js";
import type { ConfidentialClientAuthenticator } from "./token-exchange.routes.js";

function invalidClient(c: Context) {
  c.header("WWW-Authenticate", 'Basic realm="oauth"');
  return c.json({ error: "invalid_client" }, 401);
}

export function createOauthTokenManagementRoutes(options: {
  clients: ConfidentialClientAuthenticator;
  tokens: OauthTokenManagementService;
  logout: BackchannelLogoutService;
}) {
  const app = new Hono();

  app.post("/oauth2/revoke", async (c) => {
    c.header("Cache-Control", "no-store");
    c.header("Pragma", "no-cache");
    if (!(c.req.header("content-type") ?? "").includes("application/x-www-form-urlencoded")) {
      return c.json({ error: "invalid_request" }, 400);
    }
    const params = new URLSearchParams(await c.req.text());
    if (
      params.getAll("token").length !== 1 ||
      params.getAll("token_type_hint").length > 1 ||
      params.getAll("client_id").length > 1 ||
      params.getAll("client_secret").length > 1
    ) {
      return c.json({ error: "invalid_request" }, 400);
    }
    const clientId = await authenticateConfidentialClient(
      options.clients,
      c.req.header("authorization"),
      params,
    );
    if (!clientId) return invalidClient(c);
    const token = params.get("token");
    if (!token) return c.json({ error: "invalid_request" }, 400);
    const result = await options.tokens.revoke({
      requesterClientId: clientId,
      token,
      tokenTypeHint: params.get("token_type_hint") ?? undefined,
    });
    if (result.refreshRevoked && result.subjectId) {
      await options.logout.revokeClientSubject(clientId, result.subjectId);
    }
    return c.body(null, 200);
  });

  app.post("/oauth2/introspect", async (c) => {
    c.header("Cache-Control", "no-store");
    c.header("Pragma", "no-cache");
    if (!(c.req.header("content-type") ?? "").includes("application/x-www-form-urlencoded")) {
      return c.json({ error: "invalid_request" }, 400);
    }
    const params = new URLSearchParams(await c.req.text());
    if (
      params.getAll("token").length !== 1 ||
      params.getAll("token_type_hint").length > 1 ||
      params.getAll("client_id").length > 1 ||
      params.getAll("client_secret").length > 1
    ) {
      return c.json({ error: "invalid_request" }, 400);
    }
    const clientId = await authenticateConfidentialClient(
      options.clients,
      c.req.header("authorization"),
      params,
    );
    if (!clientId) return invalidClient(c);
    const token = params.get("token");
    if (!token) return c.json({ active: false });
    return c.json(
      await options.tokens.introspect({
        requesterClientId: clientId,
        token,
        tokenTypeHint: params.get("token_type_hint") ?? undefined,
      }),
    );
  });

  return app;
}
