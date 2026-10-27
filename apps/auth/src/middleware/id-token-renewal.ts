import { AUTH_ROUTE_PATH } from "@auction/auth";
import type { MiddlewareHandler } from "hono";
import type { RefreshedIdTokenService } from "../services/refreshed-id-token.service.js";
import { getOAuthTokenRequestContext } from "./oauth-token-request-context.js";

export type IdTokenRenewalOutcome = "remembered" | "renewed" | "not_renewed" | "failed";

type TokenResponseBody = Record<string, unknown> & {
  refresh_token?: unknown;
  id_token?: unknown;
  scope?: unknown;
};

async function readJsonBody(response: Response): Promise<TokenResponseBody | null> {
  try {
    const parsed: unknown = await response.clone().json();
    return parsed && typeof parsed === "object" ? (parsed as TokenResponseBody) : null;
  } catch {
    return null;
  }
}

function grantsOpenId(scope: unknown): boolean {
  return typeof scope === "string" && scope.split(/\s+/).includes("openid");
}

function withIdToken(response: Response, body: TokenResponseBody, idToken: string): Response {
  const headers = new Headers(response.headers);
  headers.delete("content-length");
  return new Response(JSON.stringify({ ...body, id_token: idToken }), {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

/**
 * Around the token endpoint: remembers each authorization-code response, and adds a renewed ID
 * token to refresh responses, which otherwise carry only new access and refresh tokens. A failure
 * here never fails the refresh itself; the client then simply keeps its current tokens.
 *
 * Mount it inside the refresh replay gate so a retried refresh replays the renewed token too.
 */
export function createIdTokenRenewalMiddleware(options: {
  renewal: Pick<RefreshedIdTokenService, "rememberIssued" | "renew">;
  onOutcome?: (outcome: IdTokenRenewalOutcome, error?: unknown) => void;
}): MiddlewareHandler {
  return async (c, next) => {
    if (
      c.req.method !== "POST" ||
      !new URL(c.req.url).pathname.endsWith(`${AUTH_ROUTE_PATH}/oauth2/token`)
    ) {
      await next();
      return;
    }
    const request = getOAuthTokenRequestContext(c);
    await next();
    if (!request || !c.res.ok) return;

    const body = await readJsonBody(c.res);
    if (!body || typeof body.refresh_token !== "string") return;

    try {
      if (request.grantType === "authorization_code" && typeof body.id_token === "string") {
        await options.renewal.rememberIssued({
          refreshToken: body.refresh_token,
          idToken: body.id_token,
        });
        options.onOutcome?.("remembered");
        return;
      }
      if (
        request.grantType === "refresh_token" &&
        request.refreshToken &&
        body.id_token === undefined &&
        grantsOpenId(body.scope)
      ) {
        const idToken = await options.renewal.renew({
          previousRefreshToken: request.refreshToken,
          nextRefreshToken: body.refresh_token,
        });
        if (!idToken) {
          options.onOutcome?.("not_renewed");
          return;
        }
        c.res = withIdToken(c.res, body, idToken);
        options.onOutcome?.("renewed");
      }
    } catch (error) {
      options.onOutcome?.("failed", error);
    }
  };
}
