import assert from "node:assert/strict";
import test from "node:test";
import { completeAuthorization, readAuthorizeOutcome } from "./oidc-authorize-response.mjs";

const callback = "https://test.lax.bid/api/auth/callback/lax-bid-web?code=abc&state=xyz";

test("reads the consent code from a first-time consent page", async () => {
  const response = new Response(
    '<form id="oidc-consent"><input id="consent-code" type="hidden" value="opaque-code"></form>',
    { status: 200, headers: { "content-type": "text/html" } },
  );
  assert.deepEqual(await readAuthorizeOutcome(response), {
    kind: "consent",
    consentCode: "opaque-code",
  });
});

test("reads the callback from a fetch-metadata JSON url envelope", async () => {
  const response = Response.json({ redirect: true, url: callback });
  assert.deepEqual(await readAuthorizeOutcome(response), {
    kind: "redirect",
    redirectUri: callback,
  });
});

test("reads the callback from a fetch-metadata JSON redirectURI envelope", async () => {
  const response = Response.json({ redirectURI: callback });
  assert.deepEqual(await readAuthorizeOutcome(response), {
    kind: "redirect",
    redirectUri: callback,
  });
});

test("reads the callback from a navigation redirect after prior consent", async () => {
  const response = new Response(null, { status: 302, headers: { location: callback } });
  assert.deepEqual(await readAuthorizeOutcome(response), {
    kind: "redirect",
    redirectUri: callback,
  });
});

test("rejects error responses and pages without a consent code", async () => {
  assert.equal(await readAuthorizeOutcome(new Response("denied", { status: 401 })), null);
  assert.equal(
    await readAuthorizeOutcome(
      new Response("<p>Sign in</p>", { status: 200, headers: { "content-type": "text/html" } }),
    ),
    null,
  );
});

test("grants consent only when the issuer renders the consent page", async () => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, body: JSON.parse(init.body) });
    return Response.json({ redirectURI: callback });
  };

  const consented = await completeAuthorization({
    authBase: "https://test-auth.lax.bid",
    authorizeResponse: new Response('<input id="consent-code" value="opaque-code">', {
      status: 200,
      headers: { "content-type": "text/html" },
    }),
    cookieHeader: "session=1",
    fetchImpl,
  });
  assert.equal(consented, callback);
  assert.deepEqual(calls, [
    {
      url: "https://test-auth.lax.bid/api/auth/oauth2/consent",
      body: { accept: true, consent_code: "opaque-code" },
    },
  ]);

  const skipped = await completeAuthorization({
    authBase: "https://test-auth.lax.bid",
    authorizeResponse: Response.json({ redirect: true, url: callback }),
    cookieHeader: "session=1",
    fetchImpl,
  });
  assert.equal(skipped, callback);
  assert.equal(calls.length, 1);
});

test("surfaces consent rejections", async () => {
  await assert.rejects(
    completeAuthorization({
      authBase: "https://test-auth.lax.bid",
      authorizeResponse: new Response('<input id="consent-code" value="opaque-code">', {
        status: 200,
        headers: { "content-type": "text/html" },
      }),
      cookieHeader: "session=1",
      fetchImpl: async () => Response.json({ error: "invalid_request" }, { status: 400 }),
    }),
    /OIDC consent failed \(400\)/,
  );
});

test("first-party skip mode rejects consent HTML and redirects without a code", async () => {
  await assert.rejects(
    completeAuthorization({
      authBase: "https://test-auth.lax.bid",
      authorizeResponse: new Response('<input id="consent-code" value="opaque-code">', {
        status: 200,
        headers: { "content-type": "text/html" },
      }),
      cookieHeader: "session=1",
      requireFirstPartySkip: true,
    }),
    /rendered consent instead of a callback redirect/,
  );

  await assert.rejects(
    completeAuthorization({
      authBase: "https://test-auth.lax.bid",
      authorizeResponse: new Response(null, {
        status: 302,
        headers: { location: "https://test.lax.bid/api/auth/callback/lax-bid-web?state=xyz" },
      }),
      cookieHeader: "session=1",
      requireFirstPartySkip: true,
    }),
    /omitted an authorization code/,
  );
});

test("first-party skip mode preserves state on a callback redirect", async () => {
  const redirect = await completeAuthorization({
    authBase: "https://test-auth.lax.bid",
    authorizeResponse: new Response(null, { status: 302, headers: { location: callback } }),
    cookieHeader: "session=1",
    requireFirstPartySkip: true,
    expectedState: "xyz",
  });
  assert.equal(redirect, callback);
});
