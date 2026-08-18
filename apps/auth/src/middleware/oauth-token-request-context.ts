import { AUTH_ROUTE_PATH } from "@auction/auth";
import type { Context, MiddlewareHandler } from "hono";

export type OAuthTokenRequestContext = {
  form: URLSearchParams | null;
  json: Record<string, unknown> | null;
  grantType: string | null;
  authorizationCode: string | null;
  refreshToken: string | null;
};

type OAuthVariables = { oauthTokenRequest: OAuthTokenRequestContext };
type OAuthContext = Context<{ Variables: OAuthVariables }>;

export function createOAuthTokenRequestContextMiddleware(): MiddlewareHandler {
  return async (context, next) => {
    if (
      context.req.method !== "POST" ||
      !new URL(context.req.url).pathname.endsWith(`${AUTH_ROUTE_PATH}/oauth2/token`)
    ) {
      await next();
      return;
    }
    const contentType = context.req.header("content-type") ?? "";
    if (
      !contentType.includes("application/x-www-form-urlencoded") &&
      !contentType.includes("application/json")
    ) {
      await next();
      return;
    }
    const body = await context.req.text();
    let form: URLSearchParams | null = null;
    let json: Record<string, unknown> | null = null;
    if (contentType.includes("application/x-www-form-urlencoded")) {
      form = new URLSearchParams(body);
    } else {
      try {
        const parsed: unknown = JSON.parse(body);
        json = isRecord(parsed) ? parsed : null;
      } catch {
        // Better Auth owns malformed JSON responses.
      }
    }
    const value = (name: string): string | null => {
      if (form) return form.get(name);
      const candidate = json?.[name];
      return typeof candidate === "string" ? candidate : null;
    };
    (context as OAuthContext).set("oauthTokenRequest", {
      form,
      json,
      grantType: value("grant_type"),
      authorizationCode: value("grant_type") === "authorization_code" ? value("code") : null,
      refreshToken: value("grant_type") === "refresh_token" ? value("refresh_token") : null,
    });
    context.req.raw = new Request(context.req.raw.url, {
      method: context.req.raw.method,
      headers: context.req.raw.headers,
      body,
    });
    await next();
  };
}

export function getOAuthTokenRequestContext(context: Context): OAuthTokenRequestContext | null {
  return (context as OAuthContext).get("oauthTokenRequest") ?? null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
