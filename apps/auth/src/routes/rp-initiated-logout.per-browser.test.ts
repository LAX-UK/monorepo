import { describe, expect, it, vi } from "vitest";
import { BrowserSignOutService } from "../services/browser-sign-out.service.js";
import { createRpInitiatedLogoutRoutes } from "./rp-initiated-logout.routes.js";

const SIGN_OUT_URL = "https://auth.example.test/api/auth/sign-out";

type TokenRow = { id: string; userId: string; sid: string | null };

/**
 * One person signed in on two devices (two records), each with a product token issued under it.
 * `authHandler` behaves as Better Auth 1.6.22 does: its end-session deletes every OAuth token of
 * the person (oidc-provider index.mjs, `deleteMany` by `userId`) and the session behind the
 * cookie; its sign-out deletes only the session.
 */
function twoDevices() {
  const sessions = new Set(["rec-a", "rec-b"]);
  const lineage = new Map<string, string>([["old-a", "rec-a"]]);
  const tokens: TokenRow[] = [
    { id: "tok-a", userId: "ann", sid: "old-a" },
    { id: "tok-b", userId: "ann", sid: "rec-b" },
    { id: "tok-other-person", userId: "ben", sid: "rec-ben" },
  ];
  const authHandler = vi.fn(async (request: Request) => {
    const path = new URL(request.url).pathname;
    if (path.endsWith("/oauth2/endsession")) {
      for (let i = tokens.length - 1; i >= 0; i--)
        if (tokens[i]?.userId === "ann") tokens.splice(i, 1);
    }
    sessions.delete("rec-a");
    return new Response(JSON.stringify({ success: true }), {
      headers: { "set-cookie": "better-auth.session_token=; Max-Age=0; Path=/" },
    });
  });
  const revokeIdentitySessions = vi.fn(async (_ids: readonly string[]) => 1);
  const announceRevoked = vi.fn(async (_userId: string, _sessionId: string) => undefined);
  const signOut = new BrowserSignOutService(
    {
      earlierNames: async (sessionId, userId) =>
        userId === "ann"
          ? [...lineage].filter(([, id]) => id === sessionId).map(([sid]) => sid)
          : [],
      deleteTokensIssuedUnder: async (userId, names) => {
        let removed = 0;
        for (let i = tokens.length - 1; i >= 0; i--) {
          const row = tokens[i];
          if (row && row.userId === userId && row.sid && names.includes(row.sid)) {
            tokens.splice(i, 1);
            removed++;
          }
        }
        return removed;
      },
    },
    { revokeIdentitySessions },
    announceRevoked,
  );
  const verify = vi.fn();
  const app = createRpInitiatedLogoutRoutes({
    authHandler,
    signOutUrl: SIGN_OUT_URL,
    verifier: { verify },
    currentSession: async () => ({ subjectId: "ann", sessionId: "rec-a" }),
    revokeIdentitySession: vi.fn(),
    signOut,
  });
  return {
    app,
    tokens,
    sessions,
    authHandler,
    verify,
    revokeIdentitySessions,
    announceRevoked,
    signOut,
  };
}

const REDIRECT = "http://localhost:3000/";
const withHint = (extra: Record<string, string> = {}) => {
  const url = new URL("https://auth.example.test/oauth2/endsession");
  url.searchParams.set("client_id", "lax-bid-web");
  url.searchParams.set("id_token_hint", "hint");
  url.searchParams.set("post_logout_redirect_uri", REDIRECT);
  for (const [name, value] of Object.entries(extra)) url.searchParams.set(name, value);
  return url.toString();
};
const hintFor = (sessionId: string, subjectId = "ann") => ({
  subjectId,
  sessionId,
  clientId: "lax-bid-web" as const,
  expired: false,
});
const ids = (tokens: TokenRow[]) => tokens.map((token) => token.id).sort();

describe("signing out of one product on one device", () => {
  it("keeps the person's tokens on their other devices", async () => {
    const world = twoDevices();
    world.verify.mockResolvedValue(hintFor("rec-a"));

    const response = await world.app.request(withHint());

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(REDIRECT);
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
    expect(ids(world.tokens)).toEqual(["tok-b", "tok-other-person"]);
  });

  it("never reaches Better Auth's end-session, which deletes every token of the person", async () => {
    const world = twoDevices();
    world.verify.mockResolvedValue(hintFor("rec-a"));

    await world.app.request(withHint());

    const paths = world.authHandler.mock.calls.map(([request]) => new URL(request.url).pathname);
    expect(paths).toEqual(["/api/auth/sign-out"]);
  });

  it("ends the browser's sign-in through an earlier id of its record, and only that browser's", async () => {
    const world = twoDevices();
    world.verify.mockResolvedValue(hintFor("old-a"));

    const response = await world.app.request(withHint());

    expect(response.status).toBe(302);
    expect(ids(world.tokens)).toEqual(["tok-b", "tok-other-person"]);
    // Products signed in through the record or any earlier id of it are told.
    expect(world.revokeIdentitySessions).toHaveBeenCalledWith(["rec-a", "old-a"]);
    expect(world.announceRevoked).toHaveBeenCalledExactlyOnceWith("ann", "old-a");
  });

  it("refuses an id that belongs to the person's other device", async () => {
    const world = twoDevices();
    world.verify.mockResolvedValue(hintFor("rec-b"));

    const response = await world.app.request(withHint());

    expect(response.status).toBe(403);
    expect(world.authHandler).not.toHaveBeenCalled();
    expect(world.revokeIdentitySessions).not.toHaveBeenCalled();
    expect(ids(world.tokens)).toEqual(["tok-a", "tok-b", "tok-other-person"]);
  });

  it("refuses another person's token, even one carrying this browser's earlier id", async () => {
    const world = twoDevices();
    world.verify.mockResolvedValue(hintFor("old-a", "ben"));

    const response = await world.app.request(withHint());

    expect(response.status).toBe(403);
    expect(world.authHandler).not.toHaveBeenCalled();
    expect(ids(world.tokens)).toEqual(["tok-a", "tok-b", "tok-other-person"]);
  });

  it("does not resolve earlier ids across people", async () => {
    const world = twoDevices();
    // The browser's cookie names Ben's record: Ann's lineage must not resolve for him.
    const app = createRpInitiatedLogoutRoutes({
      authHandler: world.authHandler,
      signOutUrl: SIGN_OUT_URL,
      verifier: { verify: vi.fn(async () => hintFor("old-a", "ben")) },
      currentSession: async () => ({ subjectId: "ben", sessionId: "rec-a" }),
      revokeIdentitySession: vi.fn(),
      signOut: world.signOut,
    });

    const response = await app.request(withHint());

    expect(response.status).toBe(403);
    expect(ids(world.tokens)).toEqual(["tok-a", "tok-b", "tok-other-person"]);
  });

  it("keeps the person signed in when the record cannot be ended: no token is deleted", async () => {
    const world = twoDevices();
    world.verify.mockResolvedValue(hintFor("rec-a"));
    world.authHandler.mockResolvedValueOnce(new Response("{}", { status: 500 }));

    const response = await world.app.request(withHint());

    expect(response.status).toBe(500);
    expect(ids(world.tokens)).toEqual(["tok-a", "tok-b", "tok-other-person"]);
  });
});

describe("signing out without an ID token", () => {
  const sameSite = { "sec-fetch-site": "same-site" };
  const request = (headers: Record<string, string>, extra: Record<string, string> = {}) => {
    const url = new URL(withHint(extra));
    url.searchParams.delete("id_token_hint");
    return new Request(url, { headers });
  };

  it("ends the browser's record on a same-site request and goes to the registered URI", async () => {
    const world = twoDevices();

    const response = await world.app.request(request(sameSite));

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(REDIRECT);
    expect(world.verify).not.toHaveBeenCalled();
    expect(world.authHandler).toHaveBeenCalledOnce();
    expect(ids(world.tokens)).toEqual(["tok-b", "tok-other-person"]);
    expect(world.revokeIdentitySessions).toHaveBeenCalledWith(["rec-a", "old-a"]);
  });

  it.each([
    ["a cross-site request", { "sec-fetch-site": "cross-site" }],
    ["a request that does not say where it came from", {}],
  ])("refuses %s, so another site cannot sign a person out", async (_name, headers) => {
    const world = twoDevices();

    const response = await world.app.request(request(headers));

    expect(response.status).toBe(400);
    expect(world.authHandler).not.toHaveBeenCalled();
    expect(ids(world.tokens)).toEqual(["tok-a", "tok-b", "tok-other-person"]);
  });

  describe("on a browser that sends no Fetch Metadata", () => {
    const product = new URL(REDIRECT).origin;

    it.each([
      ["Referer", { referer: `${product}/settings` }],
      ["Origin", { origin: product }],
    ])(
      "ends the record when the request names a registered product's page in %s",
      async (_name, headers) => {
        const world = twoDevices();

        const response = await world.app.request(request(headers));

        expect(response.status).toBe(302);
        expect(ids(world.tokens)).toEqual(["tok-b", "tok-other-person"]);
      },
    );

    it.each([
      ["another site's Referer", { referer: "https://attacker.example/page" }],
      ["a null Origin", { origin: "null" }],
      ["an unreadable Referer", { referer: "not a url" }],
      [
        "a registered Referer that Fetch Metadata says is cross-site",
        {
          referer: `${product}/`,
          "sec-fetch-site": "cross-site",
        },
      ],
    ])("refuses %s", async (_name, headers) => {
      const world = twoDevices();

      const response = await world.app.request(request(headers));

      expect(response.status).toBe(400);
      expect(world.authHandler).not.toHaveBeenCalled();
    });
  });

  it("refuses an unregistered redirect and an unknown client", async () => {
    const world = twoDevices();

    const redirect = await world.app.request(
      request(sameSite, { post_logout_redirect_uri: "https://attacker.example/" }),
    );
    const client = await world.app.request(request(sameSite, { client_id: "nobody" }));

    expect(redirect.status).toBe(400);
    expect(client.status).toBe(400);
    expect(world.authHandler).not.toHaveBeenCalled();
  });

  it("answers JSON when no redirect is asked for", async () => {
    const world = twoDevices();
    const url = "https://auth.example.test/oauth2/endsession";

    const response = await world.app.request(new Request(url, { headers: sameSite }));

    expect(response.status).toBe(200);
    expect(ids(world.tokens)).toEqual(["tok-b", "tok-other-person"]);
  });
});
