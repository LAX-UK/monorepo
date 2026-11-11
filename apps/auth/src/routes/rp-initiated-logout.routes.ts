import { REGISTERED_OIDC_CLIENTS, type RegisteredOidcClientId } from "@auction/identity-contracts";
import { Hono } from "hono";
import type { BrowserSignOutService } from "../services/browser-sign-out.service.js";
import type { RpInitiatedLogoutVerifier } from "../services/rp-initiated-logout-verifier.js";

type CurrentOpSession = {
  subjectId: string;
  sessionId: string;
};

type RpInitiatedLogoutRoutesOptions = {
  authHandler(request: Request): Promise<Response>;
  currentSession(headers: Headers): Promise<CurrentOpSession | null>;
  verifier: Pick<RpInitiatedLogoutVerifier, "verify">;
  /** Revokes RP sessions bound to a verified `sid` when the OP cookie is absent. */
  revokeIdentitySession(sessionId: string): Promise<unknown>;
  /** Ends the browser's own sign-in: its products, its record and the tokens issued under it. */
  signOut: Pick<BrowserSignOutService, "isSignInOf" | "end">;
};

type EndSessionParams = {
  postLogoutRedirectUri: string | null;
  clientId: string | null;
  idTokenHint: string | null;
  state: string | null;
};

/** Browsers say how a request relates to the issuer; a cross-site request is never a sign-out by itself. */
const SAME_SITE_FETCH = new Set(["same-origin", "same-site"]);

/**
 * RP-initiated logout. Better Auth's own end-session is never reached: it deletes every OAuth token
 * of the person, which would break product refresh on all their other browsers. Signing out of a
 * product ends this browser's sign-in only (see `BrowserSignOutService`).
 *
 * - With an ID token: it must verify, name the person the browser is signed in as, and carry the
 *   `sid` of the browser's record or one of its earlier ids.
 * - Without one (a product that lost its ID token, such as LAX Account with its session store
 *   down): a same-site request ends the browser's record, and a redirect goes only to a URI
 *   registered for the named client.
 */
export function createRpInitiatedLogoutRoutes(options: RpInitiatedLogoutRoutesOptions): Hono {
  const app = new Hono();

  app.all("/oauth2/endsession", async (c) => {
    const params = await readEndSessionParams(c);
    const currentSession = await options.currentSession(c.req.raw.headers);
    const done = (response: Response | null) =>
      response ?? finish(params.postLogoutRedirectUri, params.state);

    if (!params.idTokenHint) {
      return fallbackSignOut(c.req.raw, params, currentSession, options);
    }

    const verified = await options.verifier.verify({
      idTokenHint: params.idTokenHint,
      ...(params.clientId && Object.hasOwn(REGISTERED_OIDC_CLIENTS, params.clientId)
        ? { clientId: params.clientId as RegisteredOidcClientId }
        : {}),
    });
    if (!verified) {
      return invalidRequest("a valid id_token_hint is required for cross-site logout");
    }

    if (params.clientId && params.clientId !== verified.clientId) {
      return c.json({ error: "invalid_client" }, 400);
    }

    if (params.postLogoutRedirectUri) {
      const client = REGISTERED_OIDC_CLIENTS[verified.clientId];
      if (!client.postLogoutRedirectUris.includes(params.postLogoutRedirectUri)) {
        return invalidRequest("post_logout_redirect_uri is not registered");
      }
    }

    if (!currentSession) {
      if (verified.expired) {
        return invalidRequest("an expired id_token_hint requires a current OP session");
      }
      await options.revokeIdentitySession(verified.sessionId);
      return done(null);
    }

    if (currentSession.subjectId !== verified.subjectId) {
      return c.json(
        {
          error: "invalid_request",
          error_description: "id_token_hint does not match the current session",
        },
        403,
      );
    }
    // The token's `sid` is the browser's record or an earlier id of it: a newer sign-in in the
    // same browser took the older one over, and products may still hold its id.
    if (!(await options.signOut.isSignInOf(currentSession, verified.sessionId))) {
      return c.json(
        {
          error: "invalid_request",
          error_description: "id_token_hint is stale for the current session",
        },
        403,
      );
    }

    return done(await endBrowserSignIn(c.req.raw, currentSession, options, params));
  });

  return app;
}

/** Without an ID token: a same-site request ends this browser's record and goes to a registered URI. */
async function fallbackSignOut(
  request: Request,
  params: EndSessionParams,
  currentSession: CurrentOpSession | null,
  options: RpInitiatedLogoutRoutesOptions,
): Promise<Response> {
  if (!SAME_SITE_FETCH.has(request.headers.get("sec-fetch-site") ?? "")) {
    return invalidRequest("a valid id_token_hint is required for cross-site logout");
  }
  if (params.postLogoutRedirectUri) {
    const client =
      params.clientId && Object.hasOwn(REGISTERED_OIDC_CLIENTS, params.clientId)
        ? REGISTERED_OIDC_CLIENTS[params.clientId as RegisteredOidcClientId]
        : null;
    if (!client) return invalidRequest("client_id is required for post_logout_redirect_uri");
    if (!client.postLogoutRedirectUris.includes(params.postLogoutRedirectUri)) {
      return invalidRequest("post_logout_redirect_uri is not registered");
    }
  }
  if (!currentSession) return finish(params.postLogoutRedirectUri, params.state);
  return (
    (await endBrowserSignIn(request, currentSession, options, params)) ??
    finish(params.postLogoutRedirectUri, params.state)
  );
}

/**
 * Ends the browser's sign-in through the issuer's own sign-out, which deletes the record, expires
 * the cookie and announces it. Returns the response to send back (redirecting when asked to), or
 * null when the sign-out answered and there is nothing to add.
 */
async function endBrowserSignIn(
  request: Request,
  currentSession: CurrentOpSession,
  options: RpInitiatedLogoutRoutesOptions,
  params: EndSessionParams,
): Promise<Response | null> {
  const response = await options.signOut.end(currentSession, () =>
    options.authHandler(signOutRequest(request)),
  );
  if (!response.ok) return response;
  if (!params.postLogoutRedirectUri) return response;
  const redirect = new URL(params.postLogoutRedirectUri);
  if (params.state) redirect.searchParams.set("state", params.state);
  const headers = new Headers(response.headers);
  headers.delete("content-length");
  headers.delete("content-type");
  headers.set("Location", redirect.toString());
  return new Response(null, { status: 302, headers });
}

/** The issuer's own sign-out for the cookie this request carries, as a same-origin call. */
function signOutRequest(request: Request): Request {
  const url = new URL(request.url);
  url.pathname = url.pathname.replace(/\/oauth2\/endsession$/, "/sign-out");
  url.search = "";
  const headers = new Headers(request.headers);
  headers.set("origin", url.origin);
  headers.set("sec-fetch-site", "same-origin");
  headers.set("content-type", "application/json");
  headers.delete("content-length");
  return new Request(url, { method: "POST", headers, body: "{}" });
}

async function readEndSessionParams(c: {
  req: {
    method: string;
    url: string;
    header(name: string): string | undefined;
    parseBody(options?: { all?: boolean }): Promise<unknown>;
  };
}): Promise<EndSessionParams> {
  if (c.req.method === "POST") {
    const contentType = c.req.header("content-type") ?? "";
    if (contentType.includes("application/x-www-form-urlencoded")) {
      const body = (await c.req.parseBody()) as Record<string, string | File>;
      return {
        postLogoutRedirectUri: readParam(body, "post_logout_redirect_uri"),
        clientId: readParam(body, "client_id"),
        idTokenHint: readParam(body, "id_token_hint"),
        state: readParam(body, "state"),
      };
    }
  }

  const requestUrl = new URL(c.req.url);
  return {
    postLogoutRedirectUri: requestUrl.searchParams.get("post_logout_redirect_uri"),
    clientId: requestUrl.searchParams.get("client_id"),
    idTokenHint: requestUrl.searchParams.get("id_token_hint"),
    state: requestUrl.searchParams.get("state"),
  };
}

function readParam(body: Record<string, string | File>, name: string): string | null {
  const value = body[name];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function invalidRequest(description: string): Response {
  return Response.json(
    {
      error: "invalid_request",
      error_description: description,
    },
    { status: 400 },
  );
}

function finish(postLogoutRedirectUri: string | null, state: string | null): Response {
  if (!postLogoutRedirectUri) return Response.json({ success: true, message: "Logout successful" });
  const redirect = new URL(postLogoutRedirectUri);
  if (state) redirect.searchParams.set("state", state);
  return Response.redirect(redirect.toString(), 302);
}
