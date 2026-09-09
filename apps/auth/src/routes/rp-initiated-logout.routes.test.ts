import { describe, expect, it, vi } from "vitest";
import { createRpInitiatedLogoutRoutes } from "./rp-initiated-logout.routes.js";

function requestUrl(params: Record<string, string>): string {
  const url = new URL("https://auth.example.test/oauth2/endsession");
  for (const [name, value] of Object.entries(params)) url.searchParams.set(name, value);
  return url.toString();
}

function setup(options?: {
  verified?: {
    subjectId: string;
    sessionId: string;
    clientId: "lax-shop-web" | "lax-bid-web";
    expired?: boolean;
  } | null;
  currentSession?: { subjectId: string; sessionId: string } | null;
  upstream?: Response;
  consumeFormBody?: boolean;
}) {
  const authHandler = vi.fn(async (request: Request) => {
    if (options?.consumeFormBody) await request.formData();
    return options?.upstream ?? new Response(JSON.stringify({ success: true }));
  });
  const verifier = {
    verify: vi.fn(async () =>
      options?.verified
        ? { ...options.verified, expired: options.verified.expired ?? false }
        : null,
    ),
  };
  const currentSession = vi.fn(async () => options?.currentSession ?? null);
  return {
    app: createRpInitiatedLogoutRoutes({
      authHandler,
      verifier,
      currentSession,
    }),
    authHandler,
    verifier,
    currentSession,
  };
}

describe("RP-initiated logout routes", () => {
  it("delegates end-session requests that do not request an RP redirect", async () => {
    const { app, authHandler, verifier } = setup();
    const response = await app.request("/oauth2/endsession");

    expect(response.status).toBe(200);
    expect(authHandler).toHaveBeenCalledOnce();
    expect(verifier.verify).not.toHaveBeenCalled();
  });

  it("delegates an intact form POST when no RP redirect is requested", async () => {
    const { app, authHandler, verifier } = setup({ consumeFormBody: true });
    const response = await app.request("/oauth2/endsession", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: "lax-bid-mobile" }),
    });

    expect(response.status).toBe(200);
    expect(authHandler).toHaveBeenCalledOnce();
    expect(verifier.verify).not.toHaveBeenCalled();
  });

  it("rejects unknown clients and unregistered post-logout redirects", async () => {
    const verified = {
      subjectId: "subject-1",
      sessionId: "session-1",
      clientId: "lax-shop-web" as const,
    };
    const unknown = setup({ verified });
    const unknownResponse = await unknown.app.request(
      requestUrl({
        client_id: "unknown-client",
        id_token_hint: "header.payload.signature",
        post_logout_redirect_uri: "http://localhost:3010/",
      }),
    );
    const redirect = setup({ verified });
    const redirectResponse = await redirect.app.request(
      requestUrl({
        client_id: "lax-shop-web",
        id_token_hint: "header.payload.signature",
        post_logout_redirect_uri: "https://attacker.example/",
      }),
    );

    expect(unknownResponse.status).toBe(400);
    expect(redirectResponse.status).toBe(400);
    expect(unknown.authHandler).not.toHaveBeenCalled();
    expect(redirect.authHandler).not.toHaveBeenCalled();
  });

  it("requires a valid ID token and rejects stale or mismatched OP sessions", async () => {
    const invalid = setup({ verified: null });
    const invalidResponse = await invalid.app.request(
      requestUrl({
        client_id: "lax-shop-web",
        id_token_hint: "invalid",
        post_logout_redirect_uri: "http://localhost:3010/",
      }),
    );
    const mismatch = setup({
      verified: {
        subjectId: "subject-1",
        sessionId: "session-1",
        clientId: "lax-shop-web",
      },
      currentSession: { subjectId: "subject-2", sessionId: "session-2" },
    });
    const mismatchResponse = await mismatch.app.request(
      requestUrl({
        client_id: "lax-shop-web",
        id_token_hint: "header.payload.signature",
        post_logout_redirect_uri: "http://localhost:3010/",
      }),
    );
    const stale = setup({
      verified: {
        subjectId: "subject-1",
        sessionId: "session-old",
        clientId: "lax-shop-web",
      },
      currentSession: { subjectId: "subject-1", sessionId: "session-new" },
    });
    const staleResponse = await stale.app.request(
      requestUrl({
        client_id: "lax-shop-web",
        id_token_hint: "header.payload.signature",
        post_logout_redirect_uri: "http://localhost:3010/",
      }),
    );

    expect(invalidResponse.status).toBe(400);
    expect(invalid.authHandler).not.toHaveBeenCalled();
    expect(mismatchResponse.status).toBe(403);
    expect(mismatch.authHandler).not.toHaveBeenCalled();
    expect(staleResponse.status).toBe(403);
    expect(stale.authHandler).not.toHaveBeenCalled();
  });

  it("redirects without upstream delegation when no OP session exists", async () => {
    const { app, authHandler } = setup({
      verified: {
        subjectId: "subject-1",
        sessionId: "session-1",
        clientId: "lax-shop-web",
      },
      currentSession: null,
    });
    const response = await app.request(
      requestUrl({
        id_token_hint: "header.payload.signature",
        post_logout_redirect_uri: "http://localhost:3010/",
        state: "logout-state",
      }),
    );

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("http://localhost:3010/?state=logout-state");
    expect(authHandler).not.toHaveBeenCalled();
  });

  it("rejects an expired hint when no current OP session can bind it", async () => {
    const { app, authHandler } = setup({
      verified: {
        subjectId: "subject-1",
        sessionId: "session-1",
        clientId: "lax-shop-web",
        expired: true,
      },
      currentSession: null,
    });
    const response = await app.request(
      requestUrl({
        id_token_hint: "header.payload.signature",
        post_logout_redirect_uri: "http://localhost:3010/",
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: "invalid_request",
      error_description: expect.stringContaining("current OP session"),
    });
    expect(authHandler).not.toHaveBeenCalled();
  });

  it("accepts form-encoded POST parameters and infers the client from the verified audience", async () => {
    const { app, authHandler, verifier } = setup({
      verified: {
        subjectId: "subject-1",
        sessionId: "session-1",
        clientId: "lax-shop-web",
      },
      currentSession: { subjectId: "subject-1", sessionId: "session-1" },
      upstream: new Response(JSON.stringify({ success: true }), {
        headers: { "set-cookie": "better-auth.session_token=; Max-Age=0; Path=/" },
      }),
    });
    const response = await app.request("/oauth2/endsession", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        id_token_hint: "header.payload.signature",
        post_logout_redirect_uri: "http://localhost:3010/",
        state: "logout-state",
      }).toString(),
    });

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("http://localhost:3010/?state=logout-state");
    expect(verifier.verify).toHaveBeenCalledWith({
      idTokenHint: "header.payload.signature",
    });
    const delegated = authHandler.mock.calls[0]?.[0];
    expect(delegated?.headers.get("sec-fetch-site")).toBe("same-origin");
    expect(delegated?.headers.get("content-type")).toBeNull();
    expect(delegated?.headers.get("content-length")).toBeNull();
    expect(delegated?.method).toBe("GET");
    const delegatedUrl = new URL(delegated?.url ?? "");
    expect(delegatedUrl.searchParams.get("client_id")).toBe("lax-shop-web");
    expect(delegatedUrl.searchParams.get("id_token_hint")).toBe("header.payload.signature");
  });

  it("delegates a verified matching hint and restores the registered redirect", async () => {
    const { app, authHandler } = setup({
      verified: {
        subjectId: "subject-1",
        sessionId: "session-1",
        clientId: "lax-shop-web",
      },
      currentSession: { subjectId: "subject-1", sessionId: "session-1" },
      upstream: new Response(JSON.stringify({ success: true }), {
        headers: { "set-cookie": "better-auth.session_token=; Max-Age=0; Path=/" },
      }),
    });
    const response = await app.request(
      requestUrl({
        client_id: "lax-shop-web",
        id_token_hint: "header.payload.signature",
        post_logout_redirect_uri: "http://localhost:3010/",
        state: "logout-state",
      }),
    );

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("http://localhost:3010/?state=logout-state");
    const delegated = authHandler.mock.calls[0]?.[0];
    expect(delegated?.headers.get("sec-fetch-site")).toBe("same-origin");
    const delegatedUrl = new URL(delegated?.url ?? "");
    expect(delegatedUrl.searchParams.has("post_logout_redirect_uri")).toBe(false);
    expect(delegatedUrl.searchParams.has("state")).toBe(false);
    expect(delegatedUrl.searchParams.get("id_token_hint")).toBe("header.payload.signature");
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
  });
});
