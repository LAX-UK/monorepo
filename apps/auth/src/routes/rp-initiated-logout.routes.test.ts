import { describe, expect, it, vi } from "vitest";
import { createRpInitiatedLogoutRoutes } from "./rp-initiated-logout.routes.js";

function requestUrl(params: Record<string, string>): string {
  const url = new URL("https://auth.example.test/oauth2/endsession");
  for (const [name, value] of Object.entries(params)) url.searchParams.set(name, value);
  return url.toString();
}

function setup(options?: {
  verifiedSubject?: string | null;
  currentSubject?: string | null;
  upstream?: Response;
}) {
  const authHandler = vi.fn(
    async (_request: Request) =>
      options?.upstream ?? new Response(JSON.stringify({ success: true })),
  );
  const verifier = {
    verify: vi.fn(async () =>
      options?.verifiedSubject === null
        ? null
        : { subjectId: options?.verifiedSubject ?? "subject-1" },
    ),
  };
  const currentSessionSubject = vi.fn(
    async () => options?.currentSubject ?? options?.verifiedSubject ?? "subject-1",
  );
  return {
    app: createRpInitiatedLogoutRoutes({
      authHandler,
      verifier,
      currentSessionSubject,
    }),
    authHandler,
    verifier,
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

  it("rejects unknown clients and unregistered post-logout redirects", async () => {
    const { app, authHandler } = setup();
    const unknown = await app.request(
      requestUrl({
        client_id: "unknown-client",
        post_logout_redirect_uri: "http://localhost:3010/",
      }),
    );
    const redirect = await app.request(
      requestUrl({
        client_id: "lax-shop-web",
        post_logout_redirect_uri: "https://attacker.example/",
      }),
    );

    expect(unknown.status).toBe(400);
    expect(redirect.status).toBe(400);
    expect(authHandler).not.toHaveBeenCalled();
  });

  it("requires a valid ID token for the client and current OP session", async () => {
    const invalid = setup({ verifiedSubject: null });
    const invalidResponse = await invalid.app.request(
      requestUrl({
        client_id: "lax-shop-web",
        id_token_hint: "invalid",
        post_logout_redirect_uri: "http://localhost:3010/",
      }),
    );
    const mismatch = setup({ verifiedSubject: "subject-1", currentSubject: "subject-2" });
    const mismatchResponse = await mismatch.app.request(
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
  });

  it("delegates a verified matching hint and restores the registered redirect", async () => {
    const { app, authHandler } = setup({
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
