import { createHash, randomBytes } from "node:crypto";
import { oidcClientIdsWithImplicitConsent } from "@auction/identity-contracts";
import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import { oidcProvider } from "better-auth/plugins/oidc-provider";
import { describe, expect, it } from "vitest";

const ISSUER = "http://localhost:3003";
const SHOP_CALLBACK = "http://localhost:3010/auth/callback";
const BID_CALLBACK = "http://localhost:3000/api/auth/callback/lax-bid-web";
const MOBILE_CALLBACK = "com.lax.bid:/oauth/callback";
const PASSWORD = "correct-horse-battery-staple-32";

const FIRST_PARTY = [
  { clientId: "lax-shop-web", redirectUri: SHOP_CALLBACK, name: "LAX Shop Web" },
  { clientId: "lax-bid-web", redirectUri: BID_CALLBACK, name: "LAX Bid Web" },
] as const;

function pkce(): { verifier: string; challenge: string } {
  const verifier = randomBytes(32).toString("base64url");
  return {
    verifier,
    challenge: createHash("sha256").update(verifier).digest("base64url"),
  };
}

function cookieHeader(response: Response, jar: Map<string, string>): string {
  const values =
    typeof response.headers.getSetCookie === "function"
      ? response.headers.getSetCookie()
      : [response.headers.get("set-cookie")].filter((value): value is string => Boolean(value));
  for (const value of values) {
    const [pair] = value.split(";", 1);
    const separator = pair.indexOf("=");
    if (separator > 0) jar.set(pair.slice(0, separator), pair.slice(separator + 1));
  }
  return [...jar].map(([name, value]) => `${name}=${value}`).join("; ");
}

function authorizeUrl(input: {
  clientId: string;
  redirectUri: string;
  prompt?: string;
  scope?: string;
  challenge?: string;
  method?: string;
  maxAge?: string;
  omitPkce?: boolean;
}): URL {
  const challenge = input.challenge ?? pkce().challenge;
  const url = new URL("/api/auth/oauth2/authorize", ISSUER);
  url.searchParams.set("client_id", input.clientId);
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", input.scope ?? "openid profile email");
  url.searchParams.set("state", "opaque-state");
  if (!input.omitPkce) {
    url.searchParams.set("code_challenge", challenge);
    url.searchParams.set("code_challenge_method", input.method ?? "S256");
  }
  if (input.prompt) url.searchParams.set("prompt", input.prompt);
  if (input.maxAge) url.searchParams.set("max_age", input.maxAge);
  return url;
}

async function createIssuer() {
  const db: Record<string, unknown[]> = {
    user: [],
    session: [],
    account: [],
    verification: [],
    oauthApplication: [],
    oauthAccessToken: [],
    oauthConsent: [],
  };
  const auth = betterAuth({
    secret: "test-secret-that-is-long-enough",
    baseURL: ISSUER,
    trustedOrigins: [ISSUER, "http://localhost:3010", "http://localhost:3000"],
    database: memoryAdapter(db),
    emailAndPassword: { enabled: true },
    plugins: [
      oidcProvider({
        __skipDeprecationWarning: true,
        loginPage: `${ISSUER}/login`,
        requirePKCE: true,
        allowPlainCodeChallengeMethod: false,
        skipConsentClientIds: [...oidcClientIdsWithImplicitConsent()],
        getConsentHTML: ({ clientName }) => `<html>CONSENT:${clientName}</html>`,
      }),
    ],
  });
  const ctx = await auth.$context;
  const now = new Date();
  await ctx.adapter.create({
    model: "oauthApplication",
    data: {
      clientId: "lax-shop-web",
      name: "LAX Shop Web",
      clientSecret: "hashed-shop-secret",
      redirectUrls: SHOP_CALLBACK,
      type: "web",
      disabled: false,
      createdAt: now,
      updatedAt: now,
    },
  });
  await ctx.adapter.create({
    model: "oauthApplication",
    data: {
      clientId: "lax-bid-web",
      name: "LAX Bid Web",
      clientSecret: "hashed-bid-secret",
      redirectUrls: BID_CALLBACK,
      type: "web",
      disabled: false,
      createdAt: now,
      updatedAt: now,
    },
  });
  await ctx.adapter.create({
    model: "oauthApplication",
    data: {
      clientId: "ws-mobile",
      name: "WebSocket / Mobile",
      redirectUrls: MOBILE_CALLBACK,
      type: "public",
      disabled: false,
      createdAt: now,
      updatedAt: now,
    },
  });
  await ctx.adapter.create({
    model: "oauthApplication",
    data: {
      clientId: "disabled-shop",
      name: "Disabled Shop",
      clientSecret: "hashed-disabled-secret",
      redirectUrls: SHOP_CALLBACK,
      type: "web",
      disabled: true,
      createdAt: now,
      updatedAt: now,
    },
  });
  return { auth, db };
}

async function signIn(
  auth: ReturnType<typeof betterAuth>,
  email: string,
): Promise<Map<string, string>> {
  const signUp = await auth.handler(
    new Request(`${ISSUER}/api/auth/sign-up/email`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: ISSUER },
      body: JSON.stringify({ email, password: PASSWORD, name: "Buyer" }),
    }),
  );
  if (!signUp.ok) {
    throw new Error(`sign-up failed (${signUp.status}): ${await signUp.text()}`);
  }
  const jar = new Map<string, string>();
  cookieHeader(signUp, jar);
  if (jar.size > 0) return jar;

  const signInResponse = await auth.handler(
    new Request(`${ISSUER}/api/auth/sign-in/email`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: ISSUER },
      body: JSON.stringify({ email, password: PASSWORD }),
    }),
  );
  cookieHeader(signInResponse, jar);
  if (!signInResponse.ok || jar.size === 0) {
    throw new Error(`sign-in failed (${signInResponse.status}): ${await signInResponse.text()}`);
  }
  return jar;
}

describe("first-party OIDC consent policy", () => {
  it.each(FIRST_PARTY)(
    "redirects $clientId authorize with an existing session straight to the callback",
    async ({ clientId, redirectUri }) => {
      const { auth } = await createIssuer();
      const cookies = await signIn(auth, `${clientId}-session@lax.bid`);
      const response = await auth.handler(
        new Request(authorizeUrl({ clientId, redirectUri }), {
          headers: { cookie: [...cookies].map(([name, value]) => `${name}=${value}`).join("; ") },
        }),
      );
      expect(response.status).toBeGreaterThanOrEqual(300);
      expect(response.status).toBeLessThan(400);
      const location = new URL(response.headers.get("location") ?? "");
      expect(location.origin + location.pathname).toBe(redirectUri);
      expect(location.searchParams.get("code")).toMatch(/^[A-Za-z0-9]+$/);
      expect(location.searchParams.get("state")).toBe("opaque-state");
      expect(await response.text()).not.toContain("CONSENT:");
    },
  );

  it.each(FIRST_PARTY)(
    "completes prompt=none silently for pre-authorized $clientId",
    async ({ clientId, redirectUri }) => {
      const { auth } = await createIssuer();
      const cookies = await signIn(auth, `${clientId}-none@lax.bid`);
      const response = await auth.handler(
        new Request(authorizeUrl({ clientId, redirectUri, prompt: "none" }), {
          headers: {
            cookie: [...cookies].map(([name, value]) => `${name}=${value}`).join("; "),
          },
        }),
      );
      const location = new URL(response.headers.get("location") ?? "");
      expect(location.origin + location.pathname).toBe(redirectUri);
      expect(location.searchParams.get("code")).toBeTruthy();
      expect(location.searchParams.get("error")).toBeNull();
    },
  );

  it.each(FIRST_PARTY)(
    "resumes $clientId authorize after login without rendering consent",
    async ({ clientId, redirectUri }) => {
      const { auth } = await createIssuer();
      const email = `${clientId}-resume@lax.bid`;
      await signIn(auth, email);
      const pending = await auth.handler(new Request(authorizeUrl({ clientId, redirectUri })));
      const jar = new Map<string, string>();
      cookieHeader(pending, jar);
      expect(pending.status).toBeGreaterThanOrEqual(300);
      expect(pending.headers.get("location") ?? "").toContain("/login");

      const resumed = await auth.handler(
        new Request(`${ISSUER}/api/auth/sign-in/email`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            origin: ISSUER,
            cookie: [...jar].map(([name, value]) => `${name}=${value}`).join("; "),
          },
          body: JSON.stringify({ email, password: PASSWORD }),
        }),
      );
      cookieHeader(resumed, jar);
      const location = resumed.headers.get("location") ?? "";
      const body = await resumed.text();
      expect(body).not.toContain("CONSENT:");
      if (location) {
        const redirect = new URL(location);
        expect(redirect.origin + redirect.pathname).toBe(redirectUri);
        expect(redirect.searchParams.get("code")).toMatch(/^[A-Za-z0-9]+$/);
        return;
      }
      const parsed = JSON.parse(body) as { url?: string };
      expect(parsed.url, `resume status=${resumed.status} body=${body}`).toBeDefined();
      const redirect = new URL(parsed.url ?? "");
      expect(redirect.origin + redirect.pathname).toBe(redirectUri);
      expect(redirect.searchParams.get("code")).toMatch(/^[A-Za-z0-9]+$/);
    },
  );

  it.each(FIRST_PARTY)(
    "honors prompt=consent for $clientId",
    async ({ clientId, redirectUri, name }) => {
      const { auth } = await createIssuer();
      const cookies = await signIn(auth, `${clientId}-consent@lax.bid`);
      const forced = await auth.handler(
        new Request(authorizeUrl({ clientId, redirectUri, prompt: "consent" }), {
          headers: { cookie: [...cookies].map(([name, value]) => `${name}=${value}`).join("; ") },
        }),
      );
      expect(forced.status).toBe(200);
      expect(await forced.text()).toContain(`CONSENT:${name}`);
    },
  );

  it("keeps consent for mobile, disabled clients, and invalid redirects", async () => {
    const { auth } = await createIssuer();
    const cookies = await signIn(auth, "policy-negative@lax.bid");
    const header = [...cookies].map(([name, value]) => `${name}=${value}`).join("; ");

    const mobile = await auth.handler(
      new Request(authorizeUrl({ clientId: "ws-mobile", redirectUri: MOBILE_CALLBACK }), {
        headers: { cookie: header },
      }),
    );
    expect(mobile.status).toBe(200);
    expect(await mobile.text()).toContain("CONSENT:WebSocket / Mobile");

    const disabled = await auth.handler(
      new Request(authorizeUrl({ clientId: "disabled-shop", redirectUri: SHOP_CALLBACK }), {
        headers: { cookie: header },
      }),
    );
    expect(disabled.status).toBeGreaterThanOrEqual(300);
    expect(disabled.headers.get("location") ?? "").toMatch(/client_disabled|error/);

    const invalidRedirect = await auth.handler(
      new Request(
        authorizeUrl({
          clientId: "lax-shop-web",
          redirectUri: "https://attacker.example/callback",
        }),
        { headers: { cookie: header } },
      ),
    );
    expect(invalidRedirect.status).toBeGreaterThanOrEqual(400);

    const unknown = await auth.handler(
      new Request(authorizeUrl({ clientId: "unknown-client", redirectUri: SHOP_CALLBACK }), {
        headers: { cookie: header },
      }),
    );
    expect(unknown.status).toBeGreaterThanOrEqual(300);
    expect(unknown.headers.get("location") ?? (await unknown.text())).toMatch(
      /invalid_client|error/,
    );
  });

  it("still disables an allowlisted first-party client", async () => {
    const { auth } = await createIssuer();
    const ctx = await auth.$context;
    await ctx.adapter.update({
      model: "oauthApplication",
      where: [{ field: "clientId", value: "lax-shop-web" }],
      update: { disabled: true },
    });
    const cookies = await signIn(auth, "disabled-allowlist@lax.bid");
    const response = await auth.handler(
      new Request(authorizeUrl({ clientId: "lax-shop-web", redirectUri: SHOP_CALLBACK }), {
        headers: { cookie: [...cookies].map(([name, value]) => `${name}=${value}`).join("; ") },
      }),
    );
    expect(response.status).toBeGreaterThanOrEqual(300);
    expect(response.headers.get("location") ?? (await response.text())).toMatch(
      /client_disabled|error/,
    );
  });

  it("rejects invalid scopes, missing PKCE, and plain PKCE at authorize", async () => {
    const { auth } = await createIssuer();
    const cookies = await signIn(auth, "pkce-scope@lax.bid");
    const header = [...cookies].map(([name, value]) => `${name}=${value}`).join("; ");

    const invalidScope = await auth.handler(
      new Request(
        authorizeUrl({
          clientId: "lax-shop-web",
          redirectUri: SHOP_CALLBACK,
          scope: "openid not-a-scope",
        }),
        { headers: { cookie: header } },
      ),
    );
    expect((invalidScope.headers.get("location") ?? "") + (await invalidScope.text())).toMatch(
      /invalid_scope/,
    );

    const missingPkce = await auth.handler(
      new Request(
        authorizeUrl({ clientId: "lax-shop-web", redirectUri: SHOP_CALLBACK, omitPkce: true }),
        { headers: { cookie: header } },
      ),
    );
    expect((missingPkce.headers.get("location") ?? "") + (await missingPkce.text())).toMatch(
      /invalid_request|pkce/,
    );

    const plain = await auth.handler(
      new Request(
        authorizeUrl({
          clientId: "lax-shop-web",
          redirectUri: SHOP_CALLBACK,
          method: "plain",
        }),
        { headers: { cookie: header } },
      ),
    );
    expect((plain.headers.get("location") ?? "") + (await plain.text())).toMatch(/invalid_request/);
  });

  it("rejects a token exchange with the wrong PKCE verifier", async () => {
    const { auth } = await createIssuer();
    const { challenge, verifier } = pkce();
    const cookies = await signIn(auth, "token-pkce@lax.bid");
    const authorized = await auth.handler(
      new Request(
        authorizeUrl({ clientId: "lax-shop-web", redirectUri: SHOP_CALLBACK, challenge }),
        {
          headers: { cookie: [...cookies].map(([name, value]) => `${name}=${value}`).join("; ") },
        },
      ),
    );
    const code = new URL(authorized.headers.get("location") ?? "").searchParams.get("code");
    expect(code).toBeTruthy();
    expect(verifier.length).toBeGreaterThan(10);

    const token = await auth.handler(
      new Request(`${ISSUER}/api/auth/oauth2/token`, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded", origin: ISSUER },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code: code ?? "",
          redirect_uri: SHOP_CALLBACK,
          client_id: "lax-shop-web",
          client_secret: "hashed-shop-secret",
          code_verifier: "this-is-not-the-verifier",
        }),
      }),
    );
    expect(token.status).toBeGreaterThanOrEqual(400);
  });

  it("returns protocol errors for unsupported and silent-auth prompt combinations", async () => {
    const { auth } = await createIssuer();
    const cookies = await signIn(auth, "prompt-edges@lax.bid");
    const header = [...cookies].map(([name, value]) => `${name}=${value}`).join("; ");

    const unsupported = await auth.handler(
      new Request(
        authorizeUrl({
          clientId: "lax-shop-web",
          redirectUri: SHOP_CALLBACK,
          prompt: "none bogus",
        }),
        { headers: { cookie: header } },
      ),
    );
    expect(unsupported.status).toBeGreaterThanOrEqual(400);

    const noneAndConsent = await auth.handler(
      new Request(
        authorizeUrl({
          clientId: "lax-shop-web",
          redirectUri: SHOP_CALLBACK,
          prompt: "none consent",
        }),
        { headers: { cookie: header } },
      ),
    );
    expect(noneAndConsent.status).toBeGreaterThanOrEqual(400);

    const selectAccount = await auth.handler(
      new Request(
        authorizeUrl({
          clientId: "lax-shop-web",
          redirectUri: SHOP_CALLBACK,
          prompt: "select_account",
        }),
        { headers: { cookie: header } },
      ),
    );
    expect((selectAccount.headers.get("location") ?? "") + (await selectAccount.text())).toMatch(
      /account_selection_required/,
    );

    const staleSilent = await auth.handler(
      new Request(
        authorizeUrl({
          clientId: "lax-shop-web",
          redirectUri: SHOP_CALLBACK,
          prompt: "none",
          maxAge: "0",
        }),
        { headers: { cookie: header } },
      ),
    );
    const staleLocation = staleSilent.headers.get("location") ?? "";
    expect(staleLocation).toMatch(/login_required/);
    expect(staleLocation).not.toContain("/login?");
  });
});
