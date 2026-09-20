/**
 * Interprets a Better Auth `/oauth2/authorize` response for live acceptance probes.
 *
 * First-party Bid/Shop web clients skip the consent HTML and return a redirect
 * with an authorization code. Explicit clients (mobile and future third-party
 * apps) still render the same-origin consent page on first grant. Fetch-metadata
 * requests may instead receive a JSON redirect envelope.
 */
const CONSENT_CODE_PATTERN = /id="consent-code"[^>]+value="([^"]+)"/;

function readRedirectFromJson(body) {
  if (!body || typeof body !== "object") return null;
  if (typeof body.redirectURI === "string") return body.redirectURI;
  if (typeof body.url === "string") return body.url;
  return null;
}

function assertCallbackRedirect(redirectUri, expectedState) {
  let url;
  try {
    url = new URL(redirectUri);
  } catch {
    throw new Error(`OIDC authorize redirect is not a URL: ${redirectUri}`);
  }
  if (!url.searchParams.get("code")) {
    throw new Error(`OIDC authorize redirect omitted an authorization code (${redirectUri})`);
  }
  if (expectedState != null && url.searchParams.get("state") !== expectedState) {
    throw new Error(
      `OIDC authorize redirect state mismatch (expected ${expectedState}, got ${url.searchParams.get("state")})`,
    );
  }
  return redirectUri;
}

/**
 * @returns {Promise<
 *   | { kind: "consent"; consentCode: string }
 *   | { kind: "redirect"; redirectUri: string }
 *   | null
 * >}
 */
export async function readAuthorizeOutcome(response) {
  if (response.status < 200 || response.status >= 400) return null;

  const location = response.headers.get("location");
  if (location) return { kind: "redirect", redirectUri: location };

  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const redirectUri = readRedirectFromJson(await response.json().catch(() => null));
    return redirectUri ? { kind: "redirect", redirectUri } : null;
  }

  const consentCode = (await response.text()).match(CONSENT_CODE_PATTERN)?.[1];
  return consentCode ? { kind: "consent", consentCode } : null;
}

/**
 * Completes authorization for a signed-in subject.
 *
 * First-party probes must set `requireFirstPartySkip` so a consent page fails
 * the gate instead of being auto-accepted. Explicit-consent clients keep the
 * default permissive path.
 */
export async function completeAuthorization({
  authBase,
  authorizeResponse,
  cookieHeader,
  fetchImpl = fetch,
  onResponse = () => {},
  requireFirstPartySkip = false,
  expectedState,
}) {
  const outcome = await readAuthorizeOutcome(authorizeResponse);
  if (!outcome) {
    throw new Error(
      `OIDC authorize returned neither a consent page nor a redirect (${authorizeResponse.status})`,
    );
  }
  if (outcome.kind === "redirect") {
    return assertCallbackRedirect(outcome.redirectUri, expectedState);
  }
  if (requireFirstPartySkip) {
    throw new Error("First-party OIDC authorize rendered consent instead of a callback redirect");
  }

  const consent = await fetchImpl(`${authBase}/api/auth/oauth2/consent`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: cookieHeader,
      origin: authBase,
    },
    body: JSON.stringify({ accept: true, consent_code: outcome.consentCode }),
  });
  onResponse(consent);
  const consentBody = await consent.json().catch(() => null);
  const redirectUri = readRedirectFromJson(consentBody);
  if (!consent.ok || typeof consentBody?.redirectURI !== "string" || !redirectUri) {
    throw new Error(`OIDC consent failed (${consent.status})`);
  }
  return assertCallbackRedirect(redirectUri, expectedState);
}
