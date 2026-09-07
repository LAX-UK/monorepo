import { REGISTERED_OIDC_CLIENTS, type RegisteredOidcClientId } from "@auction/identity-contracts";
import { Hono } from "hono";
import type { RpInitiatedLogoutVerifier } from "../services/rp-initiated-logout-verifier.js";

type RpInitiatedLogoutRoutesOptions = {
  authHandler(request: Request): Promise<Response>;
  currentSessionSubject(headers: Headers): Promise<string | null>;
  verifier: Pick<RpInitiatedLogoutVerifier, "verify">;
};

export function createRpInitiatedLogoutRoutes(options: RpInitiatedLogoutRoutesOptions): Hono {
  const app = new Hono();

  app.all("/oauth2/endsession", async (c) => {
    const requestUrl = new URL(c.req.url);
    const postLogoutRedirectUri = requestUrl.searchParams.get("post_logout_redirect_uri");
    if (!postLogoutRedirectUri) return options.authHandler(c.req.raw);

    const clientId = requestUrl.searchParams.get("client_id");
    if (!clientId || !(clientId in REGISTERED_OIDC_CLIENTS)) {
      return c.json({ error: "invalid_client" }, 400);
    }
    const registeredClientId = clientId as RegisteredOidcClientId;
    const client = REGISTERED_OIDC_CLIENTS[registeredClientId];
    if (!client.postLogoutRedirectUris.includes(postLogoutRedirectUri)) {
      return c.json(
        {
          error: "invalid_request",
          error_description: "post_logout_redirect_uri is not registered",
        },
        400,
      );
    }

    const idTokenHint = requestUrl.searchParams.get("id_token_hint");
    const verified = idTokenHint
      ? await options.verifier.verify({ idTokenHint, clientId: registeredClientId })
      : null;
    if (!verified) {
      return c.json(
        {
          error: "invalid_request",
          error_description: "a valid id_token_hint is required for cross-site logout",
        },
        400,
      );
    }

    const currentSubject = await options.currentSessionSubject(c.req.raw.headers);
    if (currentSubject && currentSubject !== verified.subjectId) {
      return c.json(
        {
          error: "invalid_request",
          error_description: "id_token_hint does not match the current session",
        },
        403,
      );
    }

    const state = requestUrl.searchParams.get("state");
    requestUrl.searchParams.delete("post_logout_redirect_uri");
    requestUrl.searchParams.delete("state");
    const upstreamRequest = new Request(requestUrl, c.req.raw);
    const upstreamHeaders = new Headers(upstreamRequest.headers);
    upstreamHeaders.set("Sec-Fetch-Site", "same-origin");
    const upstream = await options.authHandler(
      new Request(upstreamRequest, { headers: upstreamHeaders }),
    );
    if (!upstream.ok) return upstream;

    const redirect = new URL(postLogoutRedirectUri);
    if (state) redirect.searchParams.set("state", state);
    const headers = new Headers(upstream.headers);
    headers.set("Location", redirect.toString());
    return new Response(null, { status: 302, headers });
  });

  return app;
}
