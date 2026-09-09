import { REGISTERED_OIDC_CLIENTS, type RegisteredOidcClientId } from "@auction/identity-contracts";
import { Hono } from "hono";
import type {
  LogoutVerificationResult,
  RpInitiatedLogoutVerifier,
} from "../services/rp-initiated-logout-verifier.js";

type CurrentOpSession = {
  subjectId: string;
  sessionId: string;
};

type RpInitiatedLogoutRoutesOptions = {
  authHandler(request: Request): Promise<Response>;
  currentSession(headers: Headers): Promise<CurrentOpSession | null>;
  verifier: Pick<RpInitiatedLogoutVerifier, "verify">;
};

type EndSessionParams = {
  postLogoutRedirectUri: string | null;
  clientId: string | null;
  idTokenHint: string | null;
  state: string | null;
};

export function createRpInitiatedLogoutRoutes(options: RpInitiatedLogoutRoutesOptions): Hono {
  const app = new Hono();

  app.all("/oauth2/endsession", async (c) => {
    const passthroughRequest = c.req.raw.clone();
    const params = await readEndSessionParams(c);
    if (!params.postLogoutRedirectUri) return options.authHandler(passthroughRequest);

    if (!params.idTokenHint) {
      return invalidRequest("a valid id_token_hint is required for cross-site logout");
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

    const client = REGISTERED_OIDC_CLIENTS[verified.clientId];
    if (!client.postLogoutRedirectUris.includes(params.postLogoutRedirectUri)) {
      return c.json(
        {
          error: "invalid_request",
          error_description: "post_logout_redirect_uri is not registered",
        },
        400,
      );
    }

    const currentSession = await options.currentSession(c.req.raw.headers);
    if (!currentSession) {
      if (verified.expired) {
        return invalidRequest("an expired id_token_hint requires a current OP session");
      }
      return redirectOnly(params.postLogoutRedirectUri, params.state);
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
    if (currentSession.sessionId !== verified.sessionId) {
      return c.json(
        {
          error: "invalid_request",
          error_description: "id_token_hint is stale for the current session",
        },
        403,
      );
    }

    return delegateVerifiedLogout({
      request: c.req.raw,
      authHandler: options.authHandler,
      verified,
      idTokenHint: params.idTokenHint,
      postLogoutRedirectUri: params.postLogoutRedirectUri,
      state: params.state,
    });
  });

  return app;
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

function redirectOnly(postLogoutRedirectUri: string, state: string | null): Response {
  const redirect = new URL(postLogoutRedirectUri);
  if (state) redirect.searchParams.set("state", state);
  return Response.redirect(redirect.toString(), 302);
}

async function delegateVerifiedLogout(input: {
  request: Request;
  authHandler(request: Request): Promise<Response>;
  verified: LogoutVerificationResult;
  idTokenHint: string;
  postLogoutRedirectUri: string;
  state: string | null;
}): Promise<Response> {
  const requestUrl = new URL(input.request.url);
  requestUrl.search = "";
  requestUrl.searchParams.set("client_id", input.verified.clientId);
  requestUrl.searchParams.set("id_token_hint", input.idTokenHint);

  const upstreamHeaders = new Headers(input.request.headers);
  upstreamHeaders.set("Sec-Fetch-Site", "same-origin");
  upstreamHeaders.delete("content-type");
  upstreamHeaders.delete("content-length");
  const upstream = await input.authHandler(
    new Request(requestUrl, { method: "GET", headers: upstreamHeaders }),
  );
  if (!upstream.ok) return upstream;

  const redirect = new URL(input.postLogoutRedirectUri);
  if (input.state) redirect.searchParams.set("state", input.state);
  const headers = new Headers(upstream.headers);
  headers.set("Location", redirect.toString());
  return new Response(null, { status: 302, headers });
}
