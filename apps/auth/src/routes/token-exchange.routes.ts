import {
  OidcClientKind,
  REGISTERED_OIDC_CLIENTS,
  type RegisteredOidcClientId,
} from "@auction/identity-contracts";
import { Hono } from "hono";
import { getOAuthTokenRequestContext } from "../middleware/oauth-token-request-context.js";
import {
  ACCESS_TOKEN_TYPE,
  TOKEN_EXCHANGE_GRANT_TYPE,
  TokenExchangeError,
  type TokenExchangeResult,
  type TokenExchangeService,
} from "../services/token-exchange.service.js";

export type ConfidentialClientAuthenticator = {
  authenticate(clientId: string, clientSecret: string): Promise<RegisteredOidcClientId | null>;
};

function parseBasicAuthorization(header: string | undefined): {
  clientId: string;
  clientSecret: string;
} | null {
  if (!header?.startsWith("Basic ")) return null;
  try {
    const decoded = Buffer.from(header.slice("Basic ".length), "base64").toString("utf8");
    const separator = decoded.indexOf(":");
    if (separator < 1) return null;
    return {
      clientId: decodeURIComponent(decoded.slice(0, separator)),
      clientSecret: decodeURIComponent(decoded.slice(separator + 1)),
    };
  } catch {
    return null;
  }
}

function oauthError(error: string, description: string) {
  return { error, error_description: description };
}

export function createTokenExchangeRoutes(options: {
  clients: ConfidentialClientAuthenticator;
  service: TokenExchangeService;
  onOutcome?: (outcome: "issued" | "rejected") => void;
}) {
  const app = new Hono();
  app.post("/oauth2/token", async (c, next) => {
    c.header("Cache-Control", "no-store");
    c.header("Pragma", "no-cache");
    if (!(c.req.header("content-type") ?? "").includes("application/x-www-form-urlencoded")) {
      await next();
      return;
    }

    const params = getOAuthTokenRequestContext(c)?.form;
    if (!params) {
      await next();
      return;
    }
    if (params.get("grant_type") !== TOKEN_EXCHANGE_GRANT_TYPE) {
      await next();
      return;
    }

    const singletonParams = [
      "grant_type",
      "subject_token",
      "subject_token_type",
      "scope",
      "requested_token_type",
      "client_id",
      "client_secret",
    ];
    if (singletonParams.some((name) => params.getAll(name).length > 1)) {
      options.onOutcome?.("rejected");
      return c.json(oauthError("invalid_request", "Request parameters must not be repeated"), 400);
    }
    const basic = parseBasicAuthorization(c.req.header("authorization"));
    const postedClientId = params.get("client_id");
    const postedClientSecret = params.get("client_secret");
    if (basic && (postedClientId || postedClientSecret)) {
      options.onOutcome?.("rejected");
      return c.json(oauthError("invalid_request", "Use one client authentication method"), 400);
    }
    const credentials =
      basic ??
      (postedClientId && postedClientSecret
        ? { clientId: postedClientId, clientSecret: postedClientSecret }
        : null);
    if (!credentials) {
      options.onOutcome?.("rejected");
      c.header("WWW-Authenticate", 'Basic realm="token"');
      return c.json(
        oauthError("invalid_client", "Confidential client authentication required"),
        401,
      );
    }
    const clientId = await options.clients.authenticate(
      credentials.clientId,
      credentials.clientSecret,
    );
    const client = clientId ? REGISTERED_OIDC_CLIENTS[clientId] : undefined;
    if (!clientId || !client || client.kind !== OidcClientKind.Confidential) {
      options.onOutcome?.("rejected");
      c.header("WWW-Authenticate", 'Basic realm="token"');
      return c.json(oauthError("invalid_client", "Client authentication failed"), 401);
    }

    if (
      params.getAll("resource").length !== 1 ||
      params.has("audience") ||
      params.has("actor_token") ||
      params.has("actor_token_type")
    ) {
      options.onOutcome?.("rejected");
      return c.json(
        oauthError("invalid_request", "Exactly one resource and no actor or audience is allowed"),
        400,
      );
    }
    const requestedTokenType = params.get("requested_token_type");
    if (requestedTokenType && requestedTokenType !== ACCESS_TOKEN_TYPE) {
      options.onOutcome?.("rejected");
      return c.json(oauthError("invalid_request", "Only access tokens can be issued"), 400);
    }

    const subjectToken = params.get("subject_token");
    const subjectTokenType = params.get("subject_token_type");
    const resource = params.get("resource");
    if (!subjectToken || !subjectTokenType || !resource) {
      options.onOutcome?.("rejected");
      return c.json(
        oauthError("invalid_request", "Missing required token exchange parameter"),
        400,
      );
    }

    try {
      const result: TokenExchangeResult = await options.service.exchange({
        clientId,
        subjectToken,
        subjectTokenType,
        resource,
        scope: params.get("scope") ?? undefined,
      });
      options.onOutcome?.("issued");
      return c.json(result);
    } catch (error) {
      options.onOutcome?.("rejected");
      if (error instanceof TokenExchangeError) {
        const status =
          error.code === "invalid_client" ? 401 : error.code === "server_error" ? 500 : 400;
        return c.json(oauthError(error.code, error.message), status);
      }
      return c.json(oauthError("server_error", "Token issuance failed"), 500);
    }
  });
  return app;
}
